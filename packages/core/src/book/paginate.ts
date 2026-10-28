/* eslint-disable @typescript-eslint/no-explicit-any */
import type { BookSettings } from "./settings";

/**
 * Fixed type metrics for the house book at US Letter. Reader, PDF, contents
 * and index all read page numbers from the one list `paginate` returns, so
 * these numbers only need to be stable, not pixel exact.
 */
export const BOOK_METRICS = {
  bodyLines: 46,
  fullChars: 78,
  stepChars: 72,
  columnChars: 36,
  titleChars: 28,
  titleLineHeight: 2,
  metaLines: 2,
  contLines: 2,
  notesLines: 6,
  contentsLines: 36,
  indexLines: 88,
  indexChars: 34,
  wordsChars: 420,
  notesPages: 2,
};

export function lineCount(text: any, width: number) {
  const words = String(text ?? "")
    .split(/\s+/)
    .filter(Boolean);
  if (!words.length) return 0;
  return words.reduce(
    (memo, word) => {
      const len = Math.min(word.length, width);
      if (memo.used === 0) return { count: memo.count, used: len };
      if (memo.used + 1 + len <= width) return { count: memo.count, used: memo.used + 1 + len };
      return { count: memo.count + 1, used: len };
    },
    { count: 1, used: 0 }
  ).count;
}

function excerpt(text: string, max: number) {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max);
  const space = cut.lastIndexOf(" ");
  return `${cut.slice(0, space > 0 ? space : max)}...`;
}

function words(recipe: any) {
  const lead = recipe.familyStory || recipe.description || recipe.steps?.[0]?.text;
  if (lead) return excerpt(lead, BOOK_METRICS.wordsChars);
  const names = (recipe.ingredients ?? []).map((item: any) => item.name || item.rawText);
  return excerpt(names.join(", "), BOOK_METRICS.wordsChars);
}

function pairs(items: any[]) {
  return items.reduce((memo: any[][], item, i) => {
    if (i % 2 === 0) return [...memo, [item]];
    const last = memo[memo.length - 1] ?? [];
    return [...memo.slice(0, -1), [...last, item]];
  }, [] as any[][]);
}

function ingredientUnits(ingredients: any[]) {
  if (!ingredients.length) return [];
  const m = BOOK_METRICS;
  const groups = ingredients.reduce((memo: any[], item) => {
    const name = item.group || null;
    const last = memo[memo.length - 1];
    if (last && last.name === name) {
      last.items.push(item.rawText);
      return memo;
    }
    return [...memo, { name, items: [item.rawText] }];
  }, []);
  const body = groups.flatMap((group: any) => [
    ...(group.name ? [{ type: "group", name: group.name, lines: 1, keepWithNext: true }] : []),
    ...pairs(group.items).map((row) => ({
      type: "ingredients",
      items: row,
      lines: Math.max(...row.map((text: string) => lineCount(text, m.columnChars))),
    })),
  ]);
  return [{ type: "ingredients-heading", lines: 2, keepWithNext: true }, ...body];
}

function stepUnits(steps: any[]) {
  if (!steps.length) return [];
  return [
    { type: "steps-heading", lines: 2, keepWithNext: true },
    ...steps.map((step, i) => ({
      type: "step",
      n: i + 1,
      text: step.text,
      lines: lineCount(step.text, BOOK_METRICS.stepChars) + 1,
    })),
  ];
}

function recipeUnits(recipe: any) {
  const m = BOOK_METRICS;
  const headnote = recipe.familyStory || recipe.description;
  return [
    {
      type: "header",
      title: recipe.title,
      servings: recipe.servings ?? null,
      yieldQuantity: recipe.yieldQuantity ?? null,
      yieldUnit: recipe.yieldUnit ?? null,
      prepTimeMinutes: recipe.prepTimeMinutes ?? null,
      cookTimeMinutes: recipe.cookTimeMinutes ?? null,
      totalTimeMinutes: recipe.totalTimeMinutes ?? null,
      lines: lineCount(recipe.title, m.titleChars) * m.titleLineHeight + m.metaLines + 1,
    },
    ...(headnote
      ? [{ type: "headnote", text: headnote, lines: lineCount(headnote, m.fullChars) + 1 }]
      : []),
    ...ingredientUnits(recipe.ingredients ?? []),
    ...stepUnits(recipe.steps ?? []),
    { type: "notes", lines: m.notesLines },
  ];
}

/** Greedy fit: a unit that does not fit starts a continuation page. Headings never strand. */
export function fit(units: any[], capacity = BOOK_METRICS.bodyLines) {
  const chunks = units.reduce(
    (memo: any[], unit, i) => {
      const page = memo[memo.length - 1];
      const need = unit.lines + (unit.keepWithNext ? (units[i + 1]?.lines ?? 0) : 0);
      if (!page.units.length || page.used + need <= capacity) {
        page.units.push(unit);
        page.used += unit.lines;
        return memo;
      }
      return [...memo, { units: [unit], used: BOOK_METRICS.contLines + unit.lines }];
    },
    [{ units: [], used: 0 }]
  );
  return chunks.map((chunk: any) =>
    chunk.units.map(({ lines: _lines, keepWithNext: _keep, ...block }: any) => block)
  );
}

function recipePages(recipe: any, settings: BookSettings) {
  const image = recipe.images?.[0];
  const opener = image
    ? { kind: "photo", recipeId: recipe.id, title: recipe.title, image }
    : {
        kind: "photo",
        recipeId: recipe.id,
        title: recipe.title,
        image: null,
        typographic: true,
        words: words(recipe),
      };
  const cards =
    recipe.isFamilyRecipe && settings.includeCards !== false
      ? (recipe.sourcePhotos ?? []).map((photo: string) => ({
          kind: "original-card",
          recipeId: recipe.id,
          title: recipe.title,
          image: photo,
        }))
      : [];
  const body = fit(recipeUnits(recipe)).map((blocks: any[], i: number) =>
    i === 0
      ? { kind: "recipe", recipeId: recipe.id, title: recipe.title, blocks }
      : { kind: "recipe-cont", recipeId: recipe.id, title: recipe.title, part: i + 1, blocks }
  );
  return [opener, ...cards, ...body];
}

function sectionsOf(recipes: any[]) {
  return recipes.reduce((memo: any[], recipe) => {
    const title = recipe.course?.trim() || "More recipes";
    const key = title.toLowerCase();
    const found = memo.find((section) => section.key === key);
    if (found) {
      found.recipes.push(recipe);
      return memo;
    }
    return [...memo, { key, title, recipes: [recipe] }];
  }, []);
}

function chunkByLines(entries: any[], capacity: number, measure: (entry: any) => number) {
  return entries.reduce(
    (memo: any[], entry) => {
      const page = memo[memo.length - 1];
      const lines = measure(entry);
      if (!page.entries.length || page.used + lines <= capacity) {
        page.entries.push(entry);
        page.used += lines;
        return memo;
      }
      return [...memo, { entries: [entry], used: lines }];
    },
    [{ entries: [], used: 0 }]
  );
}

function indexEntries(recipes: any[], startOf: Map<string, number>) {
  const byName = recipes.reduce((memo: Map<string, Set<number>>, recipe) => {
    (recipe.ingredients ?? []).forEach((item: any) => {
      const key = item.name?.trim().toLowerCase();
      if (!key) return;
      if (!memo.has(key)) memo.set(key, new Set());
      memo.get(key)!.add(startOf.get(recipe.id)!);
    });
    return memo;
  }, new Map());
  return [...byName.keys()]
    .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
    .map((key) => ({
      name: key.charAt(0).toUpperCase() + key.slice(1),
      pages: [...byName.get(key)!].sort((a, b) => a - b),
    }));
}

function coverImage(recipes: any[], settings: BookSettings) {
  const cover: any = settings.cover;
  if (cover?.kind === "type") return null;
  if (cover?.kind === "photo") return cover.image;
  if (cover?.kind === "recipe")
    return recipes.find((r) => r.id === cover.recipeId)?.images?.[0] ?? null;
  return recipes.find((r) => r.images?.length)?.images[0] ?? null;
}

/**
 * Lay a cookbook out as a book. Pure and deterministic: same cookbook and
 * settings in, same pages out. Every page carries its 1-based `number`.
 *
 * cookbook: { name, description?, recipes: [{ id, title, description?, familyStory?,
 *   course?, servings?, yieldQuantity?, yieldUnit?, prepTimeMinutes?, cookTimeMinutes?,
 *   totalTimeMinutes?, images?, isFamilyRecipe?, sourcePhotos?,
 *   ingredients: [{ rawText, name?, group? }], steps: [{ text }] }] } in book order.
 */
export function paginate(cookbook: any, settings: BookSettings = {}) {
  const m = BOOK_METRICS;
  const recipes = cookbook.recipes ?? [];
  if (!recipes.length) return [];

  const title = settings.title?.trim() || cookbook.name;
  const sections = sectionsOf(recipes);
  const showSections = sections.length > 1;
  const contentsCount = Math.ceil(
    ((showSections ? sections.length : 0) + recipes.length) / m.contentsLines
  );

  const front = [
    {
      kind: "cover",
      title,
      subtitle: settings.subtitle?.trim() || null,
      image: coverImage(recipes, settings),
    },
    ...(settings.dedication?.trim()
      ? [{ kind: "dedication", text: settings.dedication.trim() }]
      : []),
  ];
  const offset = front.length + contentsCount + 1;

  const body = sections.flatMap((section: any) => [
    ...(showSections ? [{ kind: "section", title: section.title }] : []),
    ...section.recipes.flatMap((recipe: any) => recipePages(recipe, settings)),
  ]);

  const startOf = body.reduce((memo: Map<string, number>, page: any, i: number) => {
    if (page.recipeId && !memo.has(page.recipeId)) memo.set(page.recipeId, offset + i);
    return memo;
  }, new Map());

  const contentsEntries = body.flatMap((page: any, i: number) => {
    if (page.kind === "section") return [{ type: "section", title: page.title, page: offset + i }];
    if (startOf.get(page.recipeId) === offset + i) {
      return [{ type: "recipe", recipeId: page.recipeId, title: page.title, page: offset + i }];
    }
    return [];
  });
  const contents = Array.from({ length: contentsCount }, (_, i) => ({
    kind: "contents",
    part: i + 1,
    entries: contentsEntries.slice(i * m.contentsLines, (i + 1) * m.contentsLines),
  }));

  const entries = indexEntries(recipes, startOf);
  const index = entries.length
    ? chunkByLines(entries, m.indexLines, (entry) =>
        lineCount(`${entry.name} ${entry.pages.join(", ")}`, m.indexChars)
      ).map((chunk: any, i: number) => ({ kind: "index", part: i + 1, entries: chunk.entries }))
    : [];

  const notes = Array.from({ length: m.notesPages }, () => ({ kind: "notes" }));
  const pages = [...front, ...contents, ...body, ...index, ...notes];
  const colophon = {
    kind: "colophon",
    title,
    recipeCount: recipes.length,
    pageCount: pages.length + 1,
  };

  return [...pages, colophon].map((page: any, i) => ({ number: i + 1, ...page }));
}
