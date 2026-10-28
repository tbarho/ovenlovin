import {
  shotLine,
  shotRows,
  triageSummary,
  type BookImportInput,
  type ContentsMap,
  type JobQueue,
  type TriageRow,
  type TriageSummary,
} from "@ovenlovin/core/jobs";
import { RecipeService } from "@ovenlovin/core";
import { getDatabase } from "@ovenlovin/db";
import type { BookImportJobInput } from "@/lib/book-import-view";

/** The shot-list screen: same view shape as the PDF book screen, `shoot` rows. */
export type BookShotView = {
  jobId: string;
  name: string;
  status: "ready";
  map: ContentsMap | null;
  picks: string[];
  /** Picks confirmed: the shot list is out and rows accept page photos. */
  shooting: boolean;
  triage: { rows: TriageRow[]; summary: TriageSummary; line: string };
  cookbookId: string | null;
};

type SavedLookup = Pick<RecipeService, "listBookImportRecipeIds">;

/** The shot list for a paper book: picked candidates in page order, saved ones marked. */
export async function loadBookShotList(
  queue: JobQueue,
  jobId: string,
  householdId: string,
  recipes?: SavedLookup
): Promise<BookShotView | null> {
  const job = await queue.get(jobId);
  if (!job || job.householdId !== householdId || job.kind !== "book_import") return null;
  const input = job.input as BookImportJobInput;
  if (input.source !== "photos") return null;
  const map = input.photoMap ?? null;
  const picks = map ? (input.picks ?? map.candidates.map((candidate) => candidate.id)) : [];
  const saved =
    map && input.sha256 && input.shooting
      ? await (recipes ?? new RecipeService(getDatabase())).listBookImportRecipeIds(
          householdId,
          input.sha256
        )
      : {};
  const rows = map ? shotRows(map, picks, saved) : [];
  const summary = triageSummary(rows);
  return {
    jobId,
    name: input.name,
    status: "ready",
    map,
    picks,
    shooting: Boolean(input.shooting),
    triage: { rows, summary, line: shotLine(summary) },
    cookbookId: input.cookbookId ?? null,
  };
}

/** The paper books with something still to photograph, for the recipes shelf. */
export async function listShotBookTiles(
  queue: JobQueue,
  householdId: string,
  recipes?: SavedLookup
) {
  const ids = await queue.recent(householdId, "book_import");
  const views = await Promise.all(
    ids.map((id) => loadBookShotList(queue, id, householdId, recipes))
  );
  return views.flatMap((view) => {
    if (!view || !view.map) return [];
    if (view.triage.summary.saved === view.triage.summary.total) return [];
    return [{ jobId: view.jobId, name: view.name.replace(/\.pdf$/i, ""), line: view.triage.line }];
  });
}

/** Reads the contents photos into a map. Inline: no blob, no PDF, so no queue. */
export async function mapPhotoContents(images: string[]) {
  const { readContentsPhotos } = await import("@ovenlovin/importers");
  const { buildPhotoContentsMap } = await import("@ovenlovin/core/jobs");
  const pages = await readContentsPhotos(images, { visionModelId: process.env.RK_MODEL_VISION });
  return buildPhotoContentsMap(pages);
}

/** Creates the paper book job around an already-read contents map. No blob, no items. */
export async function createShotBook(
  queue: JobQueue,
  householdId: string,
  input: { name: string; sha256: string; map: ContentsMap }
) {
  const jobInput: BookImportInput = {
    blobUrl: "",
    sha256: input.sha256,
    bytes: 0,
    pages: 0,
    name: input.name,
    verified: true,
    source: "photos",
    photoMap: input.map,
  };
  return queue.enqueue(householdId, "book_import", jobInput);
}

export type { BookImportJobInput };
