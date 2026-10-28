import { describe, expect, it } from "vitest";
import { BOOK_METRICS, fit, lineCount, paginate } from "./paginate";
import { readBookSettings } from "./settings";

const ingredient = (name: string, rawText = `1 cup ${name}`) => ({ name, rawText });

const recipe = (id: string, overrides: any = {}) => ({
  id,
  title: `Recipe ${id}`,
  course: "Mains",
  servings: 4,
  images: [`https://img/${id}.jpg`],
  ingredients: [ingredient("butter"), ingredient("flour")],
  steps: [{ text: "Mix everything." }, { text: "Bake until golden." }],
  ...overrides,
});

const longSteps = Array.from({ length: 40 }, (_, i) => ({
  text: `Step ${i + 1}: stir the pot slowly and keep the heat low so nothing catches on the bottom of the pan.`,
}));

const cookbook = {
  name: "Barho Family Kitchen",
  recipes: [
    recipe("a", { ingredients: [ingredient("Buttermilk"), ingredient("flour")] }),
    recipe("b", { images: [], description: "Grandma made this every Sunday after church." }),
    recipe("c", {
      course: "Desserts",
      steps: longSteps,
      ingredients: [ingredient("buttermilk "), ingredient("sugar")],
    }),
    recipe("d", {
      course: "Desserts",
      isFamilyRecipe: true,
      sourcePhotos: ["https://img/card-d.jpg"],
    }),
  ],
};

const pageOf = (pages: any[], n: number) => pages[n - 1];

describe("paginate", () => {
  it("is deterministic", () => {
    expect(paginate(cookbook, {})).toEqual(paginate(structuredClone(cookbook), {}));
    expect(JSON.stringify(paginate(cookbook, { dedication: "For Mom" }))).toBe(
      JSON.stringify(paginate(cookbook, { dedication: "For Mom" }))
    );
  });

  it("numbers pages 1..N in order and opens and closes like a book", () => {
    const pages = paginate(cookbook, { dedication: "For Mom, Christmas 2026" });
    pages.forEach((page, i) => expect(page.number).toBe(i + 1));
    expect(pages.map((p) => p.kind).slice(0, 4)).toEqual([
      "cover",
      "dedication",
      "contents",
      "section",
    ]);
    expect(pages[pages.length - 1]).toMatchObject({
      kind: "colophon",
      pageCount: pages.length,
      recipeCount: 4,
    });
    expect(pages.filter((p) => p.kind === "notes")).toHaveLength(BOOK_METRICS.notesPages);
  });

  it("emits every page kind", () => {
    const kinds = new Set(paginate(cookbook, { dedication: "For Mom" }).map((p) => p.kind));
    expect([...kinds].sort()).toEqual(
      [
        "colophon",
        "contents",
        "cover",
        "dedication",
        "index",
        "notes",
        "original-card",
        "photo",
        "recipe",
        "recipe-cont",
        "section",
      ].sort()
    );
  });

  it("contents page numbers land on the right section and recipe pages", () => {
    const pages = paginate(cookbook, {});
    const entries = pages.filter((p) => p.kind === "contents").flatMap((p) => p.entries);
    expect(entries.filter((e: any) => e.type === "recipe")).toHaveLength(4);
    entries.forEach((entry: any) => {
      const target = pageOf(pages, entry.page);
      if (entry.type === "section")
        return expect(target).toMatchObject({ kind: "section", title: entry.title });
      expect(target.recipeId).toBe(entry.recipeId);
      expect(pageOf(pages, entry.page - 1).recipeId).not.toBe(entry.recipeId);
    });
  });

  it("ingredient index numbers match the page list", () => {
    const pages = paginate(cookbook, {});
    const index = pages.filter((p) => p.kind === "index").flatMap((p) => p.entries);
    const buttermilk = index.find((e: any) => e.name === "Buttermilk");
    expect(buttermilk.pages).toHaveLength(2);
    index.forEach((entry: any) =>
      entry.pages.forEach((n: number) => {
        const target = pageOf(pages, n);
        const source = cookbook.recipes.find((r) => r.id === target.recipeId)!;
        expect(source.ingredients.map((i) => i.name.trim().toLowerCase())).toContain(
          entry.name.toLowerCase()
        );
      })
    );
    expect(index.map((e: any) => e.name)).toEqual([...index.map((e: any) => e.name)].sort());
  });

  it("continues a long recipe onto recipe-cont pages with the notes box last", () => {
    const pages = paginate(cookbook, {});
    const c = pages.filter((p) => p.recipeId === "c" && p.kind.startsWith("recipe"));
    expect(c.length).toBeGreaterThan(1);
    expect(c[0].kind).toBe("recipe");
    c.slice(1).forEach((page, i) =>
      expect(page).toMatchObject({ kind: "recipe-cont", part: i + 2 })
    );
    const steps = c.flatMap((p) => p.blocks).filter((b: any) => b.type === "step");
    expect(steps.map((s: any) => s.n)).toEqual(longSteps.map((_, i) => i + 1));
    expect(c[c.length - 1].blocks.at(-1).type).toBe("notes");
  });

  it("gives a no-photo recipe a typographic page from its own words", () => {
    const opener = paginate(cookbook, {}).find((p) => p.recipeId === "b");
    expect(opener).toMatchObject({
      kind: "photo",
      image: null,
      typographic: true,
      title: "Recipe b",
    });
    expect(opener.words).toBe("Grandma made this every Sunday after church.");
  });

  it("falls back to steps then ingredients for typographic words, never empty", () => {
    const bare = { name: "x", recipes: [recipe("e", { images: [], steps: [] })] };
    expect(paginate(bare, {}).find((p) => p.recipeId === "e").words).toBe("butter, flour");
  });

  it("prints original cards for family recipes unless turned off", () => {
    const card = (s: any) => paginate(cookbook, s).filter((p) => p.kind === "original-card");
    expect(card({})).toEqual([
      expect.objectContaining({ recipeId: "d", image: "https://img/card-d.jpg" }),
    ]);
    expect(card({ includeCards: false })).toEqual([]);
  });

  it("skips section dividers when there is one course", () => {
    const one = { name: "x", recipes: [recipe("a"), recipe("b")] };
    expect(paginate(one, {}).some((p) => p.kind === "section")).toBe(false);
  });

  it("returns no pages for an empty cookbook", () => {
    expect(paginate({ name: "x", recipes: [] }, {})).toEqual([]);
  });

  it("honors cover settings", () => {
    const cover = (s: any) => paginate(cookbook, s)[0];
    expect(cover({})).toMatchObject({ title: "Barho Family Kitchen", image: "https://img/a.jpg" });
    expect(
      cover({ cover: { kind: "type" }, title: "Our Book", subtitle: "Recipes" })
    ).toMatchObject({
      title: "Our Book",
      subtitle: "Recipes",
      image: null,
    });
    expect(cover({ cover: { kind: "recipe", recipeId: "d" } }).image).toBe("https://img/d.jpg");
  });

  it("spills contents and index across pages with numbers still matching", () => {
    const many = {
      name: "Big",
      recipes: Array.from({ length: 80 }, (_, i) =>
        recipe(`r${i}`, {
          course: i % 2 ? "Mains" : "Sides",
          ingredients: Array.from({ length: 6 }, (_, j) => ingredient(`ingredient ${i * 6 + j}`)),
        })
      ),
    };
    const pages = paginate(many, {});
    expect(pages.filter((p) => p.kind === "contents").length).toBeGreaterThan(1);
    expect(pages.filter((p) => p.kind === "index").length).toBeGreaterThan(1);
    pages
      .filter((p) => p.kind === "contents")
      .flatMap((p) => p.entries)
      .filter((e: any) => e.type === "recipe")
      .forEach((e: any) => expect(pageOf(pages, e.page).recipeId).toBe(e.recipeId));
  });
});

describe("fit", () => {
  it("never strands a heading at the bottom of a page", () => {
    const units = [
      { type: "header", lines: 44 },
      { type: "steps-heading", lines: 2, keepWithNext: true },
      { type: "step", lines: 3 },
    ];
    expect(fit(units).map((page) => page.map((b: any) => b.type))).toEqual([
      ["header"],
      ["steps-heading", "step"],
    ]);
  });

  it("puts an oversized unit on its own page instead of looping", () => {
    expect(
      fit([
        { type: "step", lines: 200 },
        { type: "notes", lines: 6 },
      ])
    ).toHaveLength(2);
  });
});

describe("lineCount", () => {
  it("wraps on words", () => {
    expect(lineCount("", 10)).toBe(0);
    expect(lineCount("aaaa bbbb", 9)).toBe(1);
    expect(lineCount("aaaa bbbbb", 9)).toBe(2);
  });
});

describe("readBookSettings", () => {
  it("falls back to defaults for null or bad jsonb", () => {
    expect(readBookSettings(null)).toEqual({});
    expect(readBookSettings({ cover: { kind: "nope" } })).toEqual({});
    expect(readBookSettings({ dedication: "For Mom", includeCards: false })).toEqual({
      dedication: "For Mom",
      includeCards: false,
    });
  });
});
