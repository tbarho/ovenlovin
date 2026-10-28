import { createHash } from "node:crypto";
import { constants, inflateSync } from "node:zlib";

export const BOOK_CONTENT_TYPE = "application/pdf";

export function bookUploadPath(householdId: string, sha256: string) {
  return `books/${householdId}/${sha256}.pdf`;
}

/**
 * Host for our Vercel Blob store. Prefer BLOB_STORE_HOST; otherwise derive
 * from BLOB_READ_WRITE_TOKEN (vercel_blob_rw_<storeId>_...).
 */
export function bookBlobStoreHost(env: Record<string, string | undefined> = process.env) {
  const configured = env.BLOB_STORE_HOST?.trim().toLowerCase();
  if (configured) return configured;
  const token = env.BLOB_READ_WRITE_TOKEN?.trim() ?? "";
  const match = token.match(/^vercel_blob_rw_([A-Za-z0-9]+)_/);
  if (!match) return null;
  return `${match[1]!.toLowerCase()}.public.blob.vercel-storage.com`;
}

/** Only blobs this household uploaded through the book door, on OUR Blob store. */
export function isBookBlobUrl(
  url: string,
  householdId: string,
  env: Record<string, string | undefined> = process.env
) {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") return false;
    const host = bookBlobStoreHost(env);
    if (!host) return false;
    if (parsed.hostname.toLowerCase() !== host) return false;
    return parsed.pathname.startsWith(`/books/${householdId}/`);
  } catch {
    return false;
  }
}

export function sha256Hex(bytes: Uint8Array) {
  return createHash("sha256").update(bytes).digest("hex");
}

const OBJECT = /\d+\s+\d+\s+obj\b([\s\S]*?)\bendobj\b/g;
const PAGES = /\/Type\s*\/Pages\b/;
const PAGE = /\/Type\s*\/Page\b(?!s)/g;
const COUNT = /\/Count\s+(\d+)/;

const inflate = (data: Buffer) => {
  try {
    return inflateSync(data, { finishFlush: constants.Z_SYNC_FLUSH }).toString("latin1");
  } catch {
    return "";
  }
};

/** Objects packed inside compressed object streams (PDF 1.5+), split by their offset table. */
function streamedObjects(text: string) {
  return [...text.matchAll(OBJECT)].reduce((memo: string[], [, body]) => {
    if (!/\/Type\s*\/ObjStm\b/.test(body!) || !/\/FlateDecode\b/.test(body!)) return memo;
    const start = body!.search(/stream\r?\n/);
    const end = body!.lastIndexOf("endstream");
    if (start < 0 || end < 0) return memo;
    const data = body!.slice(body!.indexOf("\n", start) + 1, end);
    const decoded = inflate(Buffer.from(data, "latin1"));
    const first = Number(body!.match(/\/First\s+(\d+)/)?.[1] ?? 0);
    const offsets = decoded
      .slice(0, first)
      .trim()
      .split(/\s+/)
      .filter((_, index) => index % 2 === 1)
      .map(Number);
    const ends = [...offsets.slice(1).map((offset) => first + offset), undefined];
    return [...memo, ...offsets.map((offset, index) => decoded.slice(first + offset, ends[index]))];
  }, []);
}

/**
 * Page count from the page tree: the root /Pages node carries the largest
 * /Count. Falls back to counting /Page leaves. Returns 0 when the file is not
 * a readable PDF. Contents mapping (slice 3) reads the text layer properly.
 */
export function countPdfPages(bytes: Uint8Array) {
  const text = Buffer.from(bytes).toString("latin1");
  if (!text.startsWith("%PDF-")) return 0;

  const objects = [
    ...[...text.matchAll(OBJECT)].map((match) => match[1]!),
    ...streamedObjects(text),
  ];
  const treeCount = objects.reduce((memo, body) => {
    if (!PAGES.test(body)) return memo;
    return Math.max(memo, Number(body.match(COUNT)?.[1] ?? 0));
  }, 0);
  if (treeCount > 0) return treeCount;

  return objects.reduce((memo, body) => memo + (body.match(PAGE)?.length ?? 0), 0);
}

export class PasswordProtectedPdfError extends Error {
  constructor(message = "This PDF is password-protected. Remove the password and try again.") {
    super(message);
    this.name = "PasswordProtectedPdfError";
  }
}

export class UnreadablePdfError extends Error {
  constructor(message = "We could not read this PDF. Try exporting or printing it to PDF again.") {
    super(message);
    this.name = "UnreadablePdfError";
  }
}

/**
 * Page count from a PDF on disk via pdf.js. Range fetches only what it needs
 * (`disableStream` + `disableAutoFetch`) so a 500MB book does not get copied
 * into a full-size buffer just to learn numPages.
 *
 * Returns 0 only for unreadable / invalid PDFs. Infrastructure errors
 * (module load, OOM, missing file) rethrow so the job retries and the blob
 * is not deleted.
 */
export async function countPdfPagesOnDisk(path: string) {
  const { open } = await import("node:fs/promises");
  const { pathToFileURL } = await import("node:url");
  const file = await open(path, "r");
  try {
    const size = (await file.stat()).size;
    if (size < 8) return 0;
    const head = Buffer.alloc(Math.min(size, 8));
    await file.read(head, 0, head.length, 0);
    if (!head.toString("latin1").startsWith("%PDF-")) return 0;
  } finally {
    await file.close();
  }

  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  // Static import so Next's file tracer ships the worker with the function.
  const worker = await import("pdfjs-dist/legacy/build/pdf.worker.mjs");
  (globalThis as { pdfjsWorker?: unknown }).pdfjsWorker = worker;

  const task = pdfjs.getDocument({
    url: pathToFileURL(path).href,
    isEvalSupported: false,
    useSystemFonts: true,
    disableAutoFetch: true,
    disableStream: true,
  } as never);
  try {
    const doc = await task.promise;
    return Number(doc.numPages) || 0;
  } catch (error) {
    const name = error instanceof Error ? error.name : "";
    if (name === "InvalidPDFException" || name === "FormatError") {
      return 0;
    }
    if (name === "PasswordException") {
      throw new PasswordProtectedPdfError();
    }
    if (name === "UnknownErrorException") {
      throw new UnreadablePdfError();
    }
    throw error;
  } finally {
    await task.destroy().catch(() => undefined);
  }
}
