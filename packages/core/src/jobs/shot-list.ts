/**
 * Shot list for a paper cookbook: the picked recipes in page order, so the
 * person flips through the book once. Rows share the triage shape so the same
 * save spine files each photographed recipe into the cookbook.
 */
import type { TriageRow, TriageSummary } from "./book-triage";
import type { ContentsCandidate, ContentsMap } from "./contents-map";

/** "p. 112 Short ribs", or just the title when the contents gave no page. */
export const shotLabel = (candidate: Pick<ContentsCandidate, "title" | "printedPage">) =>
  candidate.printedPage ? `p. ${candidate.printedPage} ${candidate.title}` : candidate.title;

/** Picked candidates by printed page; ones without a page keep their order at the end. */
export function shotOrder(candidates: ContentsCandidate[], picks: string[]) {
  return candidates
    .filter((candidate) => picks.includes(candidate.id))
    .map((candidate, at) => ({ candidate, at }))
    .sort(
      (a, b) =>
        (a.candidate.printedPage ?? Infinity) - (b.candidate.printedPage ?? Infinity) || a.at - b.at
    )
    .map(({ candidate }) => candidate);
}

/** One row per pick: `shoot` until a recipe from this book is saved for it. */
export function shotRows(
  map: ContentsMap,
  picks: string[],
  saved: Record<string, string> = {}
): TriageRow[] {
  return shotOrder(map.candidates, picks).map((candidate, order) => {
    const recipeId = saved[candidate.id] ?? null;
    const page = candidate.printedPage ?? 0;
    return {
      candidateId: candidate.id,
      title: candidate.title,
      page,
      pageStart: page,
      pageEnd: page,
      order,
      state: recipeId ? "saved" : "shoot",
      reasons: [],
      draft: null,
      duplicate: null,
      recipeId,
    };
  });
}

/** One line for the shelf tile and the shot list head. */
export function shotLine(summary: TriageSummary) {
  if (summary.total === 0) return "Pick your recipes";
  if (summary.saved === summary.total) return `${summary.total} of ${summary.total} saved`;
  return `${summary.saved} of ${summary.total} photographed`;
}
