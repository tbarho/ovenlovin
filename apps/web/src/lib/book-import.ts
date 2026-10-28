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

/** Full in-memory parse is only safe under this size on the Vercel worker. */
export const PDF_FULL_PARSE_MAX_BYTES = 32 * 1024 * 1024;

/**
 * Page count from a file on disk without loading the whole PDF when possible.
 * Order: Linearization /N in the first 1KB, classic trailer/xref /Root → /Pages
 * /Count, then full parse only when the file is under PDF_FULL_PARSE_MAX_BYTES.
 * Returns 0 when the count cannot be trusted.
 */
export async function countPdfPagesOnDisk(path: string) {
  const { open } = await import("node:fs/promises");
  const file = await open(path, "r");
  try {
    const size = (await file.stat()).size;
    if (size < 8) return 0;

    const head = Buffer.alloc(Math.min(size, 1024));
    await file.read(head, 0, head.length, 0);
    if (!head.toString("latin1").startsWith("%PDF-")) return 0;

    const linear = head.toString("latin1").match(/\/Linearized\b[\s\S]{0,200}?\/N\s+(\d+)/);
    if (linear) {
      const n = Number(linear[1]);
      if (n > 0) return n;
    }

    const fromXref = await countViaClassicXref(file, size);
    if (fromXref > 0) return fromXref;

    if (size > PDF_FULL_PARSE_MAX_BYTES) return 0;
    const { readFile } = await import("node:fs/promises");
    return countPdfPages(await readFile(path));
  } finally {
    await file.close();
  }
}

async function countViaClassicXref(
  file: {
    read: (buf: Buffer, offset: number, length: number, position: number) => Promise<unknown>;
  },
  size: number
) {
  const tailSize = Math.min(size, 256 * 1024);
  const tail = Buffer.alloc(tailSize);
  await file.read(tail, 0, tailSize, size - tailSize);
  const text = tail.toString("latin1");
  const startMatch = [...text.matchAll(/startxref\s+(\d+)\s*%%EOF/g)].pop();
  if (!startMatch) return 0;
  const xrefOffset = Number(startMatch[1]);
  if (!Number.isFinite(xrefOffset) || xrefOffset < 0 || xrefOffset >= size) return 0;

  // Classic xref tables are small; reject offsets that look like xref streams we can't parse yet.
  const window = Math.min(64 * 1024, size - xrefOffset);
  const xrefBuf = Buffer.alloc(window);
  await file.read(xrefBuf, 0, window, xrefOffset);
  const xrefText = xrefBuf.toString("latin1");
  if (!xrefText.startsWith("xref")) return 0;

  const trailer = xrefText.match(/trailer\s*<<([\s\S]*?)>>/);
  if (!trailer) return 0;
  const rootRef = trailer[1]!.match(/\/Root\s+(\d+)\s+(\d+)\s+R/);
  if (!rootRef) return 0;
  const rootObj = Number(rootRef[1]);
  const rootGen = Number(rootRef[2]);

  const entries = parseClassicXrefEntries(xrefText);
  const rootOffset = entries.get(`${rootObj}/${rootGen}`);
  if (rootOffset == null) return 0;

  const rootBuf = Buffer.alloc(Math.min(8 * 1024, size - rootOffset));
  await file.read(rootBuf, 0, rootBuf.length, rootOffset);
  const rootBody = rootBuf.toString("latin1");
  const pagesRef = rootBody.match(/\/Pages\s+(\d+)\s+(\d+)\s+R/);
  if (!pagesRef) return 0;
  const pagesObj = Number(pagesRef[1]);
  const pagesGen = Number(pagesRef[2]);
  const pagesOffset = entries.get(`${pagesObj}/${pagesGen}`);
  if (pagesOffset == null) return 0;

  const pagesBuf = Buffer.alloc(Math.min(8 * 1024, size - pagesOffset));
  await file.read(pagesBuf, 0, pagesBuf.length, pagesOffset);
  const count = Number(
    pagesBuf.toString("latin1").match(/\/Type\s*\/Pages\b[\s\S]{0,400}?\/Count\s+(\d+)/)?.[1] ?? 0
  );
  return count > 0 ? count : 0;
}

function parseClassicXrefEntries(xrefText: string) {
  const entries = new Map<string, number>();
  const section = [
    ...xrefText.matchAll(/^(\d+)\s+(\d+)\s*\n((?:[0-9]{10}\s[0-9]{5}\s[nf]\s*\n?)+)/gm),
  ];
  for (const match of section) {
    let obj = Number(match[1]);
    const rows = match[3]!.trim().split(/\n/);
    for (const row of rows) {
      const parts = row.trim().split(/\s+/);
      if (parts.length < 3) continue;
      const offset = Number(parts[0]);
      const gen = Number(parts[1]);
      const flag = parts[2];
      if (flag === "n" && Number.isFinite(offset)) {
        entries.set(`${obj}/${gen}`, offset);
      }
      obj += 1;
    }
  }
  return entries;
}
