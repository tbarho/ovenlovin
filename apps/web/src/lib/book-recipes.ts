import {
  mergeSpanLines,
  PermanentJobError,
  trimSpan,
  type BookImportInput,
  type ClaimedItem,
  type JobQueue,
  type RecipeItemPayload,
} from "@ovenlovin/core/jobs";
import { isImportAiNotARecipe } from "@ovenlovin/core/import-ai-unavailable";
import { averageHashFromRgba } from "@ovenlovin/core/photo-hash";
import { RecipeService, type StoredImagePut } from "@ovenlovin/core";
import { getDatabase } from "@ovenlovin/db";
import { runPdfSpanImport } from "@ovenlovin/importers";
import { createVercelImagePut } from "@/lib/blob-store";
import { itemsToLines } from "@/lib/book-contents";
import { isBookBlobUrl, UnreadablePdfError, withPdf } from "@/lib/book-import";
import { dataUrl, largestImage, png, SCAN_MAX_SIDE, type Pixels } from "@/lib/pdf-page-image";

/** Ornaments and spot art are small; a hero photo is at least this big on its short side. */
const MIN_HERO_SIDE = 200;
/** Long side for the stored hero candidate. */
const HERO_MAX_SIDE = 2000;

export type SpanPage = { page: number; lines: string[] };
export type SpanRead = {
  book: { title: string; author?: string };
  pages: SpanPage[];
  /** Largest embedded image per page: always on textless pages, hero-sized ones on text pages. */
  images: Record<number, Pixels>;
};

const fileTitle = (name: string) => name.replace(/\.pdf$/i, "").trim() || "Cookbook";

/**
 * Reads only the span's pages: text lines for each, plus the largest image on
 * each page. A textless page is a scan or a photo plate; which one depends on
 * the rest of the span (see planSpan).
 */
export async function readSpan(
  source: string,
  start: number,
  end: number,
  name = ""
): Promise<SpanRead> {
  const read = await withPdf(source, async (doc) => {
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const paint = pdfjs.OPS.paintImageXObject;
    const info: any = (await doc.getMetadata().catch(() => null))?.info ?? {};
    const last = Math.min(end, Number(doc.numPages) || 0);
    const numbers = Array.from({ length: Math.max(0, last - start + 1) }, (_, at) => start + at);

    const empty: SpanRead = {
      book: {
        title: String(info.Title ?? "").trim() || fileTitle(name),
        author: String(info.Author ?? "").trim() || undefined,
      },
      pages: [],
      images: {},
    };
    return numbers.reduce(async (memo: Promise<SpanRead>, number) => {
      const done = await memo;
      const page = await doc.getPage(number);
      const lines = itemsToLines((await page.getTextContent()).items as any[]);
      const image = await largestImage(page, await page.getOperatorList(), paint);
      const next = { ...done, pages: [...done.pages, { page: number, lines }] };
      if (!image) return next;
      const [, width, height] = image.args;
      if (lines.length > 0 && Math.min(width, height) < MIN_HERO_SIDE) return next;
      const pixels = await image.pixels();
      return pixels ? { ...next, images: { ...next.images, [number]: pixels } } : next;
    }, Promise.resolve(empty));
  });
  if (!read) throw new UnreadablePdfError();
  return read;
}

const isText = (page: SpanPage) => page.lines.length > 0;
const area = (pixels: Pixels) => pixels.width * pixels.height;

/**
 * Splits a span into the pages to read, the scans for vision, and the hero.
 * No text layer anywhere: every page image is a scan. Any text: textless
 * image pages are photo plates, so they are hero candidates, never scans. A
 * plate right before the next recipe is that recipe's photo (an opposite
 * page), so it is dropped here and picked up by the next span as `before`.
 * The hero only comes from pages that survive the trim.
 */
export function planSpan(
  read: Pick<SpanRead, "pages" | "images">,
  span: { nextGroup: string | null; nextTitle: string | null },
  before?: SpanPage
) {
  const trimmed = trimSpan(read.pages, span.nextGroup);
  if (!trimmed.some(isText)) {
    const scans = trimmed.flatMap((page) =>
      read.images[page.page] ? [read.images[page.page]!] : []
    );
    return { pages: trimmed, scans, hero: null };
  }
  const lastText = trimmed.reduce((memo, page, at) => (isText(page) ? at : memo), 0);
  const pages = span.nextTitle ? trimmed.slice(0, lastText + 1) : trimmed;
  const plate = before && !isText(before) ? [before] : [];
  const hero = [...plate, ...pages]
    .flatMap((page) => (read.images[page.page] ? [read.images[page.page]!] : []))
    .filter((pixels) => Math.min(pixels.width, pixels.height) >= MIN_HERO_SIDE)
    .reduce(
      (memo: Pixels | null, pixels) => (!memo || area(pixels) > area(memo) ? pixels : memo),
      null
    );
  return { pages, scans: [], hero };
}

const asBuffer = (bytes: Uint8Array) =>
  bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;

export type BookRecipeDeps = {
  read?: typeof readSpan;
  extract?: typeof runPdfSpanImport;
  put?: StoredImagePut;
  recipes?: Pick<RecipeService, "findImportDuplicate" | "findPhotoNearDuplicate">;
};

export type BookRecipeResult = {
  candidateId: string;
  route: "text" | "vision";
  draft: any;
  duplicate: { recipeId: string; title: string; match: string } | null;
};

async function findDuplicate(
  recipes: BookRecipeDeps["recipes"],
  householdId: string,
  draft: any,
  hash?: string
) {
  const exact = await recipes!.findImportDuplicate(householdId, draft);
  if (exact) return { recipeId: exact.recipe.id, title: exact.recipe.title, match: exact.match };
  const near = hash ? await recipes!.findPhotoNearDuplicate(householdId, hash) : null;
  return near ? { recipeId: near.id, title: near.title, match: "photo_near" } : null;
}

/**
 * book_import `recipe` step: read one picked recipe's pages, route text pages
 * to the text model and scanned pages to vision, keep the largest photo as the
 * hero candidate, and park the draft on the item for triage. Nothing is saved
 * as a recipe here; the draft carries the dedupe keys the save step checks.
 */
export async function extractBookRecipe(
  queue: JobQueue,
  item: ClaimedItem,
  deps: BookRecipeDeps = {}
): Promise<BookRecipeResult> {
  const job = await queue.get(item.jobId);
  if (!job) throw new PermanentJobError("Job missing");
  const input = job.input as BookImportInput;
  if (!input?.blobUrl || !isBookBlobUrl(input.blobUrl, item.householdId)) {
    throw new PermanentJobError("That upload is not one of yours");
  }
  const span = item.payload as RecipeItemPayload;

  // One page back: a photo plate opposite the recipe's first page.
  const lead = span.pageStart > 1 ? 1 : 0;
  let read: SpanRead;
  try {
    read = await (deps.read ?? readSpan)(
      input.blobUrl,
      span.pageStart - lead,
      span.pageEnd,
      input.name
    );
  } catch (error) {
    if (error instanceof UnreadablePdfError) throw new PermanentJobError(error.message);
    throw error;
  }

  const before = read.pages.find((page) => page.page < span.pageStart);
  const own = { ...read, pages: read.pages.filter((page) => page.page >= span.pageStart) };
  const { pages, scans, hero } = planSpan(own, span, before);
  const text = mergeSpanLines(pages.filter(isText), span.title, span.nextTitle).join("\n");
  const images = scans.map((scan) => dataUrl(png(scan, SCAN_MAX_SIDE)));
  const scanned = !pages.some(isText);
  if (scanned ? images.length === 0 : !text.trim()) {
    throw new PermanentJobError(`We could not find "${span.title}" on its pages.`);
  }

  let extracted;
  try {
    extracted = await (deps.extract ?? runPdfSpanImport)({
      title: span.title,
      book: read.book,
      pageStart: span.pageStart,
      pageEnd: pages[pages.length - 1]!.page,
      printedPage: span.printedPage,
      text: text || undefined,
      images: scanned ? images : undefined,
    });
  } catch (error) {
    if (isImportAiNotARecipe(error)) {
      throw new PermanentJobError(`"${span.title}" did not read as a recipe.`);
    }
    throw error;
  }

  const put = "put" in deps ? deps.put : createVercelImagePut();
  const heroBytes = hero && put ? png(hero, HERO_MAX_SIDE) : null;
  const heroUrl = heroBytes
    ? await put!({
        pathname: `recipes/${item.householdId}/book/${item.jobId}/${span.candidateId}.png`,
        body: asBuffer(heroBytes),
        contentType: "image/png",
      })
    : null;
  const hash =
    heroUrl && hero ? averageHashFromRgba(hero.width, hero.height, hero.rgba) : undefined;

  const draft = {
    ...extracted.draft,
    images: heroUrl ? [heroUrl] : [],
    source: {
      ...extracted.draft.source,
      blobRefs: [input.blobUrl],
      rawExtractionJson: {
        ...extracted.draft.source.rawExtractionJson,
        candidateId: span.candidateId,
        photoFingerprint: `pdf:${input.sha256}:${span.candidateId}`,
        ...(hash ? { photoPerceptualHash: hash } : {}),
      },
    },
  };

  const recipes = deps.recipes ?? new RecipeService(getDatabase());
  return {
    candidateId: span.candidateId,
    route: extracted.route,
    draft,
    duplicate: await findDuplicate(recipes, item.householdId, draft, hash),
  };
}
