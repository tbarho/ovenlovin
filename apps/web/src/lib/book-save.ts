import {
  CookbookService,
  draftFromSavedPreview,
  RecipeService,
  type RecipeImportDraft,
} from "@ovenlovin/core";
import { readBookSettings } from "@ovenlovin/core/book";
import type { JobQueue, TriageRow } from "@ovenlovin/core/jobs";
import { getDatabase } from "@ovenlovin/db";
import { loadBookContents, type BookImportJobInput } from "@/lib/book-import-view";

export type BookSaveEntry = { candidateId: string; reviewed?: unknown };

export type BookSaveDeps = {
  recipes?: Pick<RecipeService, "listBookImportRecipeIds" | "persistImportedDraft">;
  cookbooks?: Pick<
    CookbookService,
    "getCookbook" | "createCookbook" | "updateCookbook" | "addRecipe"
  >;
};

const fileTitle = (name: string) => name.replace(/\.pdf$/i, "").trim() || "Cookbook";

/** Book title and author from the drafts (PDF metadata), else the file name. */
export function bookIdentity(rows: TriageRow[], name: string) {
  const source = rows.find((row) => row.draft?.source?.bookTitle)?.draft.source;
  return { title: source?.bookTitle || fileTitle(name), author: source?.author || null };
}

/** A pdf source for a recipe the reader could not pull: the person types it in from the page. */
function blankSource(
  row: TriageRow,
  input: BookImportJobInput,
  book: { title: string; author: string | null }
) {
  return {
    type: "pdf",
    author: book.author ?? undefined,
    attribution: `${book.title}, p. ${row.page}`,
    bookTitle: book.title,
    pageStart: row.pageStart,
    pageEnd: row.pageEnd,
    blobRefs: [input.blobUrl],
    importerName: "pdf-importer",
    importerVersion: "0.1.0",
    licenseNote: "Cookbook/printed recipe - personal use only",
    rawExtractionJson: {
      candidateId: row.candidateId,
      photoFingerprint: `pdf:${input.sha256}:${row.candidateId}`,
    },
  };
}

/**
 * The draft to save for one row. Ready rows save their parked draft; a
 * reviewed row takes the person's edits but keeps the server's source, so the
 * book, page and dedupe keys cannot be rewritten from the browser.
 */
export function draftForRow(
  row: TriageRow,
  entry: BookSaveEntry,
  input: BookImportJobInput,
  book: { title: string; author: string | null }
): RecipeImportDraft | null {
  if (row.state === "saved" || row.state === "pulling") return null;
  if (!entry.reviewed && row.state !== "ready") return null;
  const source = row.draft?.source ?? blankSource(row, input, book);
  const stamped = {
    ...source,
    rawExtractionJson: { ...source.rawExtractionJson, bookPage: row.page },
  };
  if (!entry.reviewed) return { ...row.draft, source: stamped };
  const reviewed = entry.reviewed as Record<string, unknown>;
  const allowed: string[] = row.draft?.images ?? [];
  const images = Array.isArray(reviewed.images)
    ? reviewed.images.filter((image) => allowed.includes(image as string))
    : allowed;
  return draftFromSavedPreview({ ...reviewed, images, source: stamped });
}

/**
 * Saves picked recipes into the book's cookbook, created on first save with
 * the book's title and author. Each recipe is filed at its book position, so
 * saving Ready ones first and fixed ones later still reads in book order.
 * Repeats are safe: the PDF fingerprint dedupes, saved rows are skipped.
 */
export async function saveBookRecipes(
  queue: JobQueue,
  jobId: string,
  context: { householdId: string; createdBy: string },
  entries: BookSaveEntry[],
  deps: BookSaveDeps = {}
) {
  const db = deps.recipes && deps.cookbooks ? null : getDatabase();
  const recipes = deps.recipes ?? new RecipeService(db!);
  const cookbooks = deps.cookbooks ?? new CookbookService(db!);
  const view = await loadBookContents(queue, jobId, context.householdId, recipes);
  if (!view) return null;
  const input = (await queue.get(jobId))!.input as BookImportJobInput;
  const book = bookIdentity(view.triage.rows, view.name);

  const wanted = new Map(entries.map((entry) => [entry.candidateId, entry]));
  const targets = view.triage.rows.flatMap((row) => {
    const entry = wanted.get(row.candidateId);
    const draft = entry ? draftForRow(row, entry, input, book) : null;
    return draft ? [{ row, draft }] : [];
  });
  if (targets.length === 0) return { cookbookId: view.cookbookId, saved: [] };

  const existing = view.cookbookId ? await cookbooks.getCookbook(view.cookbookId) : null;
  const cookbook =
    existing && existing.householdId === context.householdId
      ? existing
      : await cookbooks.createCookbook({
          householdId: context.householdId,
          name: book.title,
          description: book.author ? `By ${book.author}` : null,
          createdBy: context.createdBy,
          bookSettings: { title: book.title, ...(book.author ? { subtitle: book.author } : {}) },
        });
  if (cookbook.id !== view.cookbookId) await queue.patchInput(jobId, { cookbookId: cookbook.id });

  const saved = await targets.reduce(
    async (
      memo: Promise<{ candidateId: string; recipeId: string; images: string[] }[]>,
      target
    ) => {
      const done = await memo;
      const result = await recipes.persistImportedDraft(target.draft, context);
      if (result.outcome === "in_flight") return done;
      await cookbooks.addRecipe(cookbook.id, result.recipe.id, target.row.order);
      return [
        ...done,
        {
          candidateId: target.row.candidateId,
          recipeId: result.recipe.id,
          images: result.recipe.images ?? [],
        },
      ];
    },
    Promise.resolve([])
  );

  const settings = readBookSettings(cookbook.bookSettings);
  const cover = saved.find((recipe) => recipe.images.length > 0);
  if (!settings.cover && cover) {
    await cookbooks.updateCookbook(cookbook.id, {
      bookSettings: { ...settings, cover: { kind: "recipe", recipeId: cover.recipeId } },
    });
  }

  return {
    cookbookId: cookbook.id,
    saved: saved.map(({ candidateId, recipeId }) => ({ candidateId, recipeId })),
  };
}
