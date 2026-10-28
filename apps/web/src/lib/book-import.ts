import { createHash } from "node:crypto";
import { constants, inflateSync } from "node:zlib";

export const BOOK_CONTENT_TYPE = "application/pdf";

export function bookUploadPath(householdId: string, sha256: string) {
  return `books/${householdId}/${sha256}.pdf`;
}

/** Only blobs this household uploaded through the book door, on Vercel Blob. */
export function isBookBlobUrl(url: string, householdId: string) {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") return false;
    if (!parsed.hostname.endsWith(".blob.vercel-storage.com")) return false;
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
