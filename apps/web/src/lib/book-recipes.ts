import {
  mergeSpanLines,
  planRecipeItems,
  PermanentJobError,
  recipeProgress,
  trimSpan,
  type BookImportInput,
  type ClaimedItem,
  type JobQueue,
  type RecipeItemPayload,
} from "@ovenlovin/core/jobs";
import { isImportAiNotARecipe } from "@ovenlovin/core/import-ai-unavailable";
import {
  averageHashFromRgba,
  downscaleRgba,
  encodePngRgba,
  rgbaFromPdfImage,
} from "@ovenlovin/core/photo-hash";
import { RecipeService, type StoredImagePut } from "@ovenlovin/core";
import { getDatabase } from "@ovenlovin/db";
import { runPdfSpanImport } from "@ovenlovin/importers";
import { createVercelImagePut } from "@/lib/blob-store";
import { itemsToLines } from "@/lib/book-contents";
import { isBookBlobUrl, UnreadablePdfError, withPdf } from "@/lib/book-import";
import { loadBookContents } from "@/lib/book-import-view";

/** Ornaments and spot art are small; a hero photo is at least this big on its short side. */
const MIN_HERO_SIDE = 200;
/** Long side for page scans sent to the vision model. */
const SCAN_MAX_SIDE = 1600;
/** Long side for the stored hero candidate. */
const HERO_MAX_SIDE = 2000;

type Pixels = { width: number; height: number; rgba: Uint8Array };
export type SpanPage = { page: number; lines: string[] };
export type SpanRead = {
  book: { title: string; author?: string };
  pages: SpanPage[];
  /** Largest embedded image on a text page. */
  hero: Pixels | null;
  /** Page scans for pages with no text layer, by page number. */
  scans: Record<number, Pixels>;
};

const imageArea = (args: any[]) => Number(args[1]) * Number(args[2]);

async function imagePixels(page: any, name: string): Promise<Pixels | null> {
  const store = name.startsWith("g_") ? page.commonObjs : page.objs;
  const image: any = await new Promise((resolve) => store.get(name, resolve));
  if (!image?.data) return null;
  const rgba = rgbaFromPdfImage(image);
  return rgba ? { width: image.width, height: image.height, rgba } : null;
}

/** Largest XObject image painted on the page, by pixel count. */
async function largestImage(page: any, ops: any, paint: number) {
  const best = ops.fnArray.reduce(
    (memo: any[] | null, fn: number, at: number) =>
      fn === paint && (!memo || imageArea(ops.argsArray[at]) > imageArea(memo))
        ? ops.argsArray[at]
        : memo,
    null
  );
  return best ? { args: best, pixels: () => imagePixels(page, best[0]) } : null;
}

const fileTitle = (name: string) => name.replace(/\.pdf$/i, "").trim() || "Cookbook";

/**
 * Reads only the span's pages: text lines for each, the page scan for pages
 * with no text layer (a scanned book page is one full-page image), and the
 * largest real photo on the text pages as the hero candidate.
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
      hero: null,
      scans: {},
    };
    return numbers.reduce(async (memo: Promise<SpanRead>, number) => {
      const done = await memo;
      const page = await doc.getPage(number);
      const lines = itemsToLines((await page.getTextContent()).items as any[]);
      const image = await largestImage(page, await page.getOperatorList(), paint);
      const next = { ...done, pages: [...done.pages, { page: number, lines }] };
      if (!image) return next;
      if (lines.length === 0) {
        const scan = await image.pixels();
        return scan ? { ...next, scans: { ...next.scans, [number]: scan } } : next;
      }
      const [, width, height] = image.args;
      const bigger = !done.hero || width * height > done.hero.width * done.hero.height;
      if (Math.min(width, height) < MIN_HERO_SIDE || !bigger) return next;
      return { ...next, hero: (await image.pixels()) ?? done.hero };
    }, Promise.resolve(empty));
  });
  if (!read) throw new UnreadablePdfError();
  return read;
}

const png = (pixels: Pixels, max: number) => {
  const small = downscaleRgba(pixels.width, pixels.height, pixels.rgba, max);
  return encodePngRgba(small.width, small.height, small.rgba);
};

const dataUrl = (bytes: Uint8Array) =>
  `data:image/png;base64,${Buffer.from(bytes).toString("base64")}`;

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

  let read: SpanRead;
  try {
    read = await (deps.read ?? readSpan)(input.blobUrl, span.pageStart, span.pageEnd, input.name);
  } catch (error) {
    if (error instanceof UnreadablePdfError) throw new PermanentJobError(error.message);
    throw error;
  }

  const pages = trimSpan(read.pages, span.nextGroup);
  const textPages = pages.filter((page) => page.lines.length > 0);
  const text = mergeSpanLines(textPages, span.title, span.nextTitle).join("\n");
  const images = pages.flatMap((page) =>
    read.scans[page.page] ? [dataUrl(png(read.scans[page.page]!, SCAN_MAX_SIDE))] : []
  );
  const scanned = textPages.length < pages.length;
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
  const heroBytes = read.hero && put ? png(read.hero, HERO_MAX_SIDE) : null;
  const heroUrl = heroBytes
    ? await put!({
        pathname: `recipes/${item.householdId}/book/${item.jobId}/${span.candidateId}.png`,
        body: asBuffer(heroBytes),
        contentType: "image/png",
      })
    : null;
  const hash =
    heroUrl && read.hero
      ? averageHashFromRgba(read.hero.width, read.hero.height, read.hero.rgba)
      : undefined;

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
