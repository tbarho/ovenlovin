import {
  planRecipeItems,
  recipeProgress,
  resolvePicks,
  triageLine,
  triageRows,
  triageSummary,
  type RecipeProgress,
  type BookImportInput,
  type ContentsMap,
  type JobQueue,
  type TriageRow,
  type TriageSummary,
} from "@ovenlovin/core/jobs";
import { RecipeService } from "@ovenlovin/core";
import { getDatabase } from "@ovenlovin/db";

export type BookImportJobInput = BookImportInput & { picks?: string[]; cookbookId?: string };

export type BookContentsView = {
  jobId: string;
  name: string;
  pages: number;
  status: "reading" | "ready" | "failed";
  error: string | null;
  map: ContentsMap | null;
  picks: string[];
  /** Recipes pulled so far, once the picks are confirmed. */
  progress: RecipeProgress;
  /** Ready / Needs a look per picked recipe, in book order. Empty until picks are confirmed. */
  triage: { rows: TriageRow[]; summary: TriageSummary; line: string };
  cookbookId: string | null;
};

type SavedLookup = Pick<RecipeService, "listBookImportRecipeIds">;

const isRecipeItem = (item: any) => item.payload?.step === "recipe";

/** What the book screen needs: the contents map, saved picks, and triage once recipes come in. */
export async function loadBookContents(
  queue: JobQueue,
  jobId: string,
  householdId: string,
  recipes?: SavedLookup
): Promise<BookContentsView | null> {
  const job = await queue.get(jobId);
  if (!job || job.householdId !== householdId || job.kind !== "book_import") return null;
  const input = job.input as BookImportJobInput;
  const items = await queue.items(jobId);
  const failed = items.find((item: any) => item.status === "failed" && !isRecipeItem(item));
  const contents = items.find((item: any) => item.payload?.step === "contents");
  const map = contents?.status === "done" ? (contents.result as ContentsMap) : null;
  const saved =
    input.sha256 && items.some(isRecipeItem)
      ? await (recipes ?? new RecipeService(getDatabase())).listBookImportRecipeIds(
          householdId,
          input.sha256
        )
      : {};
  const rows = triageRows(items, saved);
  const summary = triageSummary(rows);

  const status = map ? "ready" : failed ? "failed" : "reading";
  return {
    jobId,
    name: input.name,
    pages: input.pages,
    status,
    error: status === "failed" ? (failed?.error ?? null) : null,
    map,
    picks: map ? resolvePicks(map.candidates, input.picks) : [],
    progress: recipeProgress(items),
    triage: { rows, summary, line: triageLine(summary) },
    cookbookId: input.cookbookId ?? null,
  };
}

/**
 * Confirms the picks: one `recipe` item per picked recipe, in book order.
 * Safe to repeat; recipes already queued are skipped, newly picked ones added.
 */
export async function startRecipeExtraction(queue: JobQueue, jobId: string, householdId: string) {
  const view = await loadBookContents(queue, jobId, householdId);
  if (!view?.map) return null;
  const payloads = planRecipeItems(view.map, view.picks, view.pages);
  const added = await queue.addItems(jobId, payloads, new Date(), "candidateId");
  return { added, progress: recipeProgress(await queue.items(jobId)) };
}

export type BookImportTile = { jobId: string; name: string; line: string };

/** Books still being triaged, for the recipes shelf. Fully saved books show as their cookbook. */
export async function listBookImportTiles(
  queue: JobQueue,
  householdId: string
): Promise<BookImportTile[]> {
  const ids = await queue.recent(householdId, "book_import");
  const views = await Promise.all(ids.map((id) => loadBookContents(queue, id, householdId)));
  return views.flatMap((view) => {
    if (!view || view.status !== "ready") return [];
    const { summary, line } = view.triage;
    if (summary.total > 0 && summary.saved === summary.total) return [];
    return [{ jobId: view.jobId, name: view.name.replace(/\.pdf$/i, ""), line }];
  });
}
