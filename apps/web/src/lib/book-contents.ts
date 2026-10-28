import { unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  buildContentsMap,
  PermanentJobError,
  type BookImportInput,
  type ClaimedItem,
  type ContentsMap,
  type JobQueue,
  type PdfPageText,
} from "@ovenlovin/core/jobs";
import { isBookBlobUrl, UnreadablePdfError, withPdf } from "@/lib/book-import";
import { streamToTemp } from "@/lib/book-import-verify";

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
 * Scanned pages (no text layer) need a page render, then the vision model.
 * Parked: pdf.js needs a canvas to render on Node, and the vision read lands
 * with per-recipe extraction. Until then scanned pages stay listed on the map
 * as `scannedPages` and the contents screen says so.
 */
export type ScannedPageReader = (
  path: string,
  pages: number[]
) => Promise<Record<number, string[]>>;

export const readScannedPages: ScannedPageReader = async () => ({});

export async function mapPdf(path: string, readScanned: ScannedPageReader = readScannedPages) {
  const pages = await readPdfText(path);
  const scanned = pages.filter((page) => page.lines.length === 0).map((page) => page.page);
  const read = scanned.length ? await readScanned(path, scanned) : {};
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
