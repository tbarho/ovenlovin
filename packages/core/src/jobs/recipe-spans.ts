/**
 * Per-recipe extraction planning for a whole-cookbook PDF. Pure: the contents
 * map and picks in, one job item payload per picked recipe out; page text in,
 * one merged recipe text out.
 */
import { isIngredient, normalizeTitle, type ContentsMap, type PdfPageText } from "./contents-map";

/** Longest run of pages one recipe may take. A recipe longer than this is rare. */
export const MAX_RECIPE_SPAN = 4;

export type RecipeItemPayload = {
  step: "recipe";
  candidateId: string;
  title: string;
  group: string | null;
  printedPage: number | null;
  pageStart: number;
  pageEnd: number;
  /** The recipe after this one, so the reader knows where to stop. */
  nextTitle: string | null;
  /** Set when the next recipe opens a new section (a divider page may sit before it). */
  nextGroup: string | null;
};

type Start = {
  id: string;
  title: string;
  group: string | null;
  printedPage: number | null;
  page: number;
};

/**
 * One payload per pick, in book order. A span runs from the recipe's page to
 * the page before the next recipe (picked or not), stops before the contents
 * or index pages, and never runs past MAX_RECIPE_SPAN pages or the book.
 */
export function planRecipeItems(
  map: ContentsMap,
  picks: string[],
  pages: number
): RecipeItemPayload[] {
  const starts: Start[] = map.candidates
    .filter(
      (candidate) => candidate.pdfPage && candidate.pdfPage >= 1 && candidate.pdfPage <= pages
    )
    .map((candidate) => ({
      id: candidate.id,
      title: candidate.title,
      group: candidate.group,
      printedPage: candidate.printedPage,
      page: candidate.pdfPage!,
    }))
    .sort((a, b) => a.page - b.page);

  return starts.flatMap((start, at) => {
    if (!picks.includes(start.id)) return [];
    const next = starts.slice(at + 1).find((other) => other.page >= start.page);
    const fence = [next?.page, ...map.mapPages.filter((page) => page > start.page)]
      .filter((page): page is number => typeof page === "number")
      .reduce((memo, page) => Math.min(memo, page - 1), pages);
    const pageEnd = Math.max(start.page, Math.min(fence, start.page + MAX_RECIPE_SPAN - 1));
    return [
      {
        step: "recipe" as const,
        candidateId: start.id,
        title: start.title,
        group: start.group,
        printedPage: start.printedPage,
        pageStart: start.page,
        pageEnd,
        nextTitle: next?.title ?? null,
        nextGroup: next && next.group !== start.group ? next.group : null,
      },
    ];
  });
}

const PAGE_NUMBER = /^\d{1,4}$/;
const clean = (line: string) => line.replace(/\s+/g, " ").trim();
const bodyLines = (page: PdfPageText) =>
  page.lines.map(clean).filter((line) => line && !PAGE_NUMBER.test(line));

/** A short page with no ingredients that names the next section is its divider. */
const isDivider = (page: PdfPageText, nextGroup: string | null) => {
  if (!nextGroup) return false;
  const lines = bodyLines(page);
  return (
    lines.length <= 3 &&
    !lines.some(isIngredient) &&
    lines.some((line) => normalizeTitle(line) === normalizeTitle(nextGroup))
  );
};

/** Drops trailing section dividers. The first page always stays. */
export function trimSpan(pages: PdfPageText[], nextGroup: string | null = null) {
  const keep = pages.reduceRight(
    (memo, page, at) => (memo === at + 1 && at > 0 && isDivider(page, nextGroup) ? at : memo),
    pages.length
  );
  return pages.slice(0, keep);
}

/** Running header/footer key: digits dropped so "Soups 12" and "Soups 13" match. */
const runningKey = (line: string) => normalizeTitle(line.replace(/\d+/g, ""));

/**
 * The span's text as one recipe: page numbers and running heads removed,
 * words hyphenated across a page break rejoined, text before the title on the
 * first page and from the next recipe's title on dropped.
 */
export function mergeSpanLines(
  pages: PdfPageText[],
  title: string,
  nextTitle: string | null = null
): string[] {
  const perPage = pages.map(bodyLines);
  const edges = perPage.flatMap((lines) => [lines[0], lines[lines.length - 1]]);
  const running = new Set(
    perPage.length < 2
      ? []
      : edges
          .filter((line): line is string => Boolean(line))
          .map(runningKey)
          .filter((key, at, keys) => key && keys.indexOf(key) !== at)
  );

  const merged = perPage
    .map((lines) =>
      lines.filter(
        (line, at) => !(at === 0 || at === lines.length - 1) || !running.has(runningKey(line))
      )
    )
    .reduce((memo: string[], lines) => {
      const last = memo[memo.length - 1];
      const first = lines[0];
      if (last && first && /[a-z]-$/i.test(last) && /^[a-z]/.test(first)) {
        return [...memo.slice(0, -1), `${last.slice(0, -1)}${first}`, ...lines.slice(1)];
      }
      return [...memo, ...lines];
    }, []);

  const wanted = normalizeTitle(title);
  const from = merged.findIndex((line) => normalizeTitle(line) === wanted);
  const body = from > 0 ? merged.slice(from) : merged;
  if (!nextTitle) return body;
  const stop = body.findIndex(
    (line, at) => at > 0 && normalizeTitle(line) === normalizeTitle(nextTitle)
  );
  return stop > 0 ? body.slice(0, stop) : body;
}

export type RecipeProgress = { total: number; done: number; failed: number };

/** "x of y" for the recipe items on a book job. Setup steps do not count. */
export function recipeProgress(items: { status: string; payload: unknown }[]): RecipeProgress {
  return items
    .filter((item) => (item.payload as { step?: string } | null)?.step === "recipe")
    .reduce(
      (memo, item) => ({
        total: memo.total + 1,
        done: memo.done + (item.status === "done" ? 1 : 0),
        failed: memo.failed + (item.status === "failed" ? 1 : 0),
      }),
      { total: 0, done: 0, failed: 0 }
    );
}
