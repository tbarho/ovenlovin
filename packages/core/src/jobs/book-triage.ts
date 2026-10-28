/* eslint-disable @typescript-eslint/no-explicit-any -- jsonb job payloads */
/**
 * Triage for a whole-cookbook import: each picked recipe is Ready (save it as
 * is) or Needs a look (open it first). Pure: job items and the recipes already
 * saved from this book in, rows in book order and a plain summary out.
 */
import type { RecipeItemPayload } from "./recipe-spans";

/** Below this the model was unsure enough that a person should read it first. */
export const READY_CONFIDENCE = 0.8;

export type TriageState = "pulling" | "ready" | "needs_look" | "saved";

export type TriageRow = {
  candidateId: string;
  title: string;
  /** Printed page when the contents gave one, else the PDF page. */
  page: number;
  pageStart: number;
  pageEnd: number;
  /** Position in the book; the cookbook keeps this order. */
  order: number;
  state: TriageState;
  reasons: string[];
  draft: any | null;
  /** A recipe already in the kitchen this one may repeat. */
  duplicate: { recipeId: string; title: string } | null;
  recipeId: string | null;
};

export type TriageSummary = {
  total: number;
  ready: number;
  needsLook: number;
  pulling: number;
  saved: number;
};

type Item = { status: string; payload: unknown; result?: unknown; error?: string | null };

/** Why a finished draft needs a person, in plain words. Empty means Ready. */
export function lookReasons(draft: any, duplicate: { title: string } | null = null): string[] {
  const uncertain: string[] = draft?.uncertainFields ?? [];
  const unsure =
    Boolean(draft?.needsReview) || Number(draft?.overallConfidence ?? 0) < READY_CONFIDENCE;
  return [
    duplicate ? `Might already be in your kitchen as ${duplicate.title}.` : null,
    (draft?.ingredients ?? []).length === 0 ? "No ingredients found." : null,
    (draft?.steps ?? []).length === 0 ? "No steps found." : null,
    uncertain.length > 0 ? `Check ${uncertain.join(", ")}.` : null,
    unsure && uncertain.length === 0 ? "Parts were hard to read." : null,
  ].filter((reason): reason is string => Boolean(reason));
}

function rowState(item: Item, recipeId: string | null, reasons: string[]): TriageState {
  if (recipeId) return "saved";
  if (item.status === "failed") return "needs_look";
  if (item.status !== "done") return "pulling";
  return reasons.length > 0 ? "needs_look" : "ready";
}

/** One row per recipe item, in book order. `saved` maps candidate ids to recipe ids. */
export function triageRows(items: Item[], saved: Record<string, string> = {}): TriageRow[] {
  return items
    .filter((item) => (item.payload as { step?: string } | null)?.step === "recipe")
    .map((item) => ({ item, span: item.payload as RecipeItemPayload }))
    .sort((a, b) => a.span.pageStart - b.span.pageStart)
    .map(({ item, span }, order) => {
      const result: any = item.status === "done" ? item.result : null;
      const recipeId = saved[span.candidateId] ?? null;
      const reasons =
        item.status === "failed"
          ? [item.error || "We could not read this recipe."]
          : result
            ? lookReasons(result.draft, result.duplicate)
            : [];
      return {
        candidateId: span.candidateId,
        title: result?.draft?.title || span.title,
        page: span.printedPage ?? span.pageStart,
        pageStart: span.pageStart,
        pageEnd: span.pageEnd,
        order,
        state: rowState(item, recipeId, reasons),
        reasons,
        draft: result?.draft ?? null,
        duplicate: result?.duplicate ?? null,
        recipeId,
      };
    });
}

export function triageSummary(rows: TriageRow[]): TriageSummary {
  return rows.reduce(
    (memo, row) => ({
      ...memo,
      ready: memo.ready + (row.state === "ready" ? 1 : 0),
      needsLook: memo.needsLook + (row.state === "needs_look" ? 1 : 0),
      pulling: memo.pulling + (row.state === "pulling" ? 1 : 0),
      saved: memo.saved + (row.state === "saved" ? 1 : 0),
    }),
    { total: rows.length, ready: 0, needsLook: 0, pulling: 0, saved: 0 }
  );
}

/** One line for the import tile and the triage head. */
export function triageLine(summary: TriageSummary): string {
  if (summary.total === 0) return "Pick your recipes";
  if (summary.pulling > 0) {
    return `Reading ${summary.total - summary.pulling} of ${summary.total}`;
  }
  if (summary.saved === summary.total) return `${summary.total} of ${summary.total} saved`;
  return `${summary.ready + summary.saved} of ${summary.total} ready`;
}
