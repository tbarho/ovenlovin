import { unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { isAiGatewayConfigured } from "@ovenlovin/core/onboarding";
import {
  buildContentsMap,
  findContentsPages,
  PermanentJobError,
  type BookImportInput,
  type ClaimedItem,
  type ContentsMap,
  type JobQueue,
  type PdfPageText,
} from "@ovenlovin/core/jobs";
import { isBookBlobUrl, UnreadablePdfError, withPdf } from "@/lib/book-import";
import { streamToTemp } from "@/lib/book-import-verify";
import { dataUrl, largestImage, png, SCAN_MAX_SIDE } from "@/lib/pdf-page-image";

type TextItem = { str: string; transform: number[] };

/** pdf.js text items to reading-order lines: top to bottom, then left to right. */
export function itemsToLines(items: TextItem[]) {
  const rows = items
    .filter((item) => item.str?.trim())
    .reduce((memo: Map<number, TextItem[]>, item) => {
      const y = Math.round(item.transform[5]! / 2) * 2;
      memo.set(y, [...(memo.get(y) ?? []), item]);
      return memo;
    }, new Map());
  return [...rows.entries()]
    .sort((a: [number, TextItem[]], b: [number, TextItem[]]) => b[0] - a[0])
    .map(([, row]: [number, TextItem[]]) =>
      row
        .sort((a: TextItem, b: TextItem) => a.transform[4]! - b.transform[4]!)
        .map((item: TextItem) => item.str)
        .join(" ")
        .replace(/\s+/g, " ")
        .trim()
    )
    .filter(Boolean);
}

/** Text layer for every page. Pages with no text come back with no lines (scanned). */
export async function readPdfText(path: string): Promise<PdfPageText[]> {
  const pages = await withPdf(path, async (doc) => {
    const count = Number(doc.numPages) || 0;
    return Array.from({ length: count }, (_, index) => index + 1).reduce(
      async (memo: Promise<PdfPageText[]>, number) => {
        const done = await memo;
        const page = await doc.getPage(number);
        const content = await page.getTextContent();
        page.cleanup();
        return [...done, { page: number, lines: itemsToLines(content.items as TextItem[]) }];
      },
      Promise.resolve([])
    );
  });
  if (!Array.isArray(pages) || pages.length === 0) throw new UnreadablePdfError();
  return pages;
}

/**
 * Lines for scanned pages (no text layer), keyed by PDF page. Pages it could
 * not or did not read are left out and stay on the map as `scannedPages`.
 */
export type ScannedPageReader = (
  path: string,
  pages: number[],
  total: number
) => Promise<Record<number, string[]>>;

/** One entry per image, in the order given (the contents-photo read). */
export type ContentsVision = (images: string[]) => Promise<PdfPageText[]>;

/** Scanned front matter pages sent to vision when looking for a contents page. */
export const SCAN_FRONT_PAGES = 4;
/** Scanned back pages sent to vision when the front had no contents (an index). */
export const SCAN_BACK_PAGES = 4;

/**
 * The scanned pages worth a vision read: contents sit in the front matter, an
 * index at the back. Everything else is read per recipe, only when picked.
 * Bounded so a 300-page scan costs a few pages, not the book.
 */
export function scannedMapPages(scanned: number[], total: number) {
  const frontEnd = Math.max(8, Math.ceil(total / 5));
  const front = scanned.filter((page) => page <= frontEnd).slice(0, SCAN_FRONT_PAGES);
  const back = scanned
    .filter((page) => page > total / 2 && !front.includes(page))
    .slice(-SCAN_BACK_PAGES);
  return { front, back };
}

/** Each page's full-page scan as a PNG data URL. Pages with no image are skipped. */
export async function scannedPageImages(
  path: string,
  pages: number[]
): Promise<Record<number, string>> {
  const images = await withPdf(path, async (doc) => {
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const paint = pdfjs.OPS.paintImageXObject;
    return pages.reduce(async (memo: Promise<Record<number, string>>, number) => {
      const done = await memo;
      const page = await doc.getPage(number);
      const image = await largestImage(page, await page.getOperatorList(), paint);
      const pixels = image ? await image.pixels() : null;
      page.cleanup();
      return pixels ? { ...done, [number]: dataUrl(png(pixels, SCAN_MAX_SIDE)) } : done;
    }, Promise.resolve({}));
  });
  return images || {};
}

const defaultVision: ContentsVision = async (images) => {
  const { readContentsPhotos } = await import("@ovenlovin/importers");
  return readContentsPhotos(images, { visionModelId: process.env.RK_MODEL_VISION });
};

export type ScannedReaderDeps = {
  vision?: ContentsVision;
  images?: typeof scannedPageImages;
  env?: Record<string, string | undefined>;
  /** Why a read was skipped or failed. Defaults to a server log line. */
  report?: (reason: string, error?: unknown) => void;
};

/**
 * Reads the likely contents and index scans with the contents-photo vision
 * path. Front first; the back only when the front held no contents page. Never
 * throws: no AI Gateway, no page image, or a failed read leaves those pages
 * unread so the map still builds from the text layer.
 */
export function createScannedPageReader(deps: ScannedReaderDeps = {}): ScannedPageReader {
  const report =
    deps.report ??
    ((reason: string, error?: unknown) => console.warn(`Scanned contents read: ${reason}`, error));
  const images = deps.images ?? scannedPageImages;

  async function readBatch(path: string, pages: number[]) {
    if (pages.length === 0) return {};
    try {
      const found = await images(path, pages);
      const numbers = pages.filter((page) => found[page]);
      if (numbers.length === 0) {
        report("no page images");
        return {};
      }
      const read = await (deps.vision ?? defaultVision)(numbers.map((page) => found[page]!));
      return numbers.reduce((memo: Record<number, string[]>, page, at) => {
        const lines = read[at]?.lines.filter((line) => line.trim()) ?? [];
        return lines.length ? { ...memo, [page]: lines } : memo;
      }, {});
    } catch (error) {
      report("vision read failed", error);
      return {};
    }
  }

  return async (path, scanned, total) => {
    if (!deps.vision && !isAiGatewayConfigured(deps.env ?? process.env)) {
      report("AI Gateway is not configured");
      return {};
    }
    const { front, back } = scannedMapPages(scanned, total);
    const fromFront = await readBatch(path, front);
    const asPages = Object.entries(fromFront).map(([page, lines]) => ({
      page: Number(page),
      lines,
    }));
    if (findContentsPages(asPages).length > 0) return fromFront;
    return { ...fromFront, ...(await readBatch(path, back)) };
  };
}

export const readScannedPages: ScannedPageReader = createScannedPageReader();

export async function mapPdf(path: string, readScanned: ScannedPageReader = readScannedPages) {
  const pages = await readPdfText(path);
  const scanned = pages.filter((page) => page.lines.length === 0).map((page) => page.page);
  const read = scanned.length ? await readScanned(path, scanned, pages.length) : {};
  const merged = pages.map((page) =>
    read[page.page] ? { ...page, lines: read[page.page]! } : page
  );
  const map = buildContentsMap(merged);
  return { ...map, scannedPages: scanned.filter((page) => !read[page]?.length) };
}

/** book_import `contents` step: pull the PDF again, read its text, build the candidate list. */
export async function mapBookContents(
  queue: JobQueue,
  item: ClaimedItem,
  readScanned?: ScannedPageReader
): Promise<ContentsMap> {
  const job = await queue.get(item.jobId);
  if (!job) throw new PermanentJobError("Job missing");
  const input = job.input as BookImportInput;
  if (!input?.blobUrl || !isBookBlobUrl(input.blobUrl, item.householdId)) {
    throw new PermanentJobError("That upload is not one of yours");
  }

  const path = join(tmpdir(), `ovenlovin-book-${item.jobId}-contents.pdf`);
  try {
    await streamToTemp(input.blobUrl, path);
    return await mapPdf(path, readScanned);
  } catch (error) {
    if (error instanceof UnreadablePdfError) throw new PermanentJobError(error.message);
    throw error;
  } finally {
    await unlink(path).catch(() => undefined);
  }
}
