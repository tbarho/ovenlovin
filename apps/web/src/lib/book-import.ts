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

type DiskFile = Awaited<ReturnType<typeof import("node:fs/promises").open>>;

/**
 * Page count from a file on disk without loading the whole PDF when possible.
 * Walks the xref root (classic table or xref stream), never trusts a loose
 * Linearization /N. Full parse only under PDF_FULL_PARSE_MAX_BYTES.
 */
export async function countPdfPagesOnDisk(path: string) {
  const { open } = await import("node:fs/promises");
  const file = await open(path, "r");
  try {
    const size = (await file.stat()).size;
    if (size < 8) return 0;

    const head = Buffer.alloc(Math.min(size, 16));
    await file.read(head, 0, head.length, 0);
    if (!head.toString("latin1").startsWith("%PDF-")) return 0;

    const fromXref = await countViaXref(file, size);
    if (fromXref > 0) return fromXref;

    if (size > PDF_FULL_PARSE_MAX_BYTES) return 0;
    const { readFile } = await import("node:fs/promises");
    return countPdfPages(await readFile(path));
  } finally {
    await file.close();
  }
}

async function readSlice(file: DiskFile, start: number, length: number) {
  const size = Math.max(0, length);
  const buf = Buffer.alloc(size);
  if (size === 0) return buf;
  await file.read(buf, 0, size, start);
  return buf;
}

async function countViaXref(file: DiskFile, size: number) {
  const tailSize = Math.min(size, 256 * 1024);
  const tail = await readSlice(file, size - tailSize, tailSize);
  const text = tail.toString("latin1");
  const startMatch = [...text.matchAll(/startxref\s+(\d+)\s*%%EOF/g)].pop();
  if (!startMatch) return 0;
  let xrefOffset = Number(startMatch[1]);
  if (!Number.isFinite(xrefOffset) || xrefOffset < 0 || xrefOffset >= size) return 0;

  const entries = new Map<
    string,
    { kind: "abs"; offset: number } | { kind: "stm"; stm: number; index: number }
  >();
  let rootRef: { obj: number; gen: number } | null = null;
  let hops = 0;

  while (hops < 8 && xrefOffset >= 0 && xrefOffset < size) {
    hops += 1;
    const peek = (await readSlice(file, xrefOffset, Math.min(32, size - xrefOffset))).toString(
      "latin1"
    );
    if (peek.startsWith("xref")) {
      const parsed = await parseClassicXrefSection(file, size, xrefOffset);
      for (const [key, value] of parsed.entries) entries.set(key, value);
      if (!rootRef && parsed.root) rootRef = parsed.root;
      xrefOffset = parsed.prev ?? -1;
      continue;
    }
    const parsed = await parseXrefStreamSection(file, size, xrefOffset);
    if (!parsed) return 0;
    for (const [key, value] of parsed.entries) entries.set(key, value);
    if (!rootRef && parsed.root) rootRef = parsed.root;
    xrefOffset = parsed.prev ?? -1;
  }

  if (!rootRef) return 0;
  const catalog = await readPdfObject(file, size, entries, rootRef.obj, rootRef.gen);
  if (!catalog) return 0;
  const pagesRef = catalog.match(/\/Pages\s+(\d+)\s+(\d+)\s+R/);
  if (!pagesRef) return 0;
  const pages = await readPdfObject(file, size, entries, Number(pagesRef[1]), Number(pagesRef[2]));
  if (!pages) return 0;
  const count = Number(pages.match(/\/Type\s*\/Pages\b[\s\S]*?\/Count\s+(\d+)/)?.[1] ?? 0);
  return count > 0 ? count : 0;
}

async function parseClassicXrefSection(file: DiskFile, size: number, xrefOffset: number) {
  // Trailer sits between the xref table and startxref. Read a window that
  // covers the table head + a trailer hunt back from the next startxref-ish.
  const window = Math.min(size - xrefOffset, 1024 * 1024);
  const buf = await readSlice(file, xrefOffset, window);
  const text = buf.toString("latin1");
  const trailerMatch = text.match(/trailer\s*<<([\s\S]*?)>>/);
  if (!trailerMatch) {
    return { entries: new Map(), root: null, prev: null };
  }
  const trailer = trailerMatch[1]!;
  const rootMatch = trailer.match(/\/Root\s+(\d+)\s+(\d+)\s+R/);
  const prevMatch = trailer.match(/\/Prev\s+(\d+)/);
  const root = rootMatch ? { obj: Number(rootMatch[1]), gen: Number(rootMatch[2]) } : null;
  const prev = prevMatch ? Number(prevMatch[1]) : null;

  const entries = new Map<string, { kind: "abs"; offset: number }>();
  // Random-access style: walk subsection headers and compute row offsets.
  const headerRe = /^(\d+)\s+(\d+)\s*$/gm;
  let match: RegExpExecArray | null;
  while ((match = headerRe.exec(text))) {
    // Skip the literal "xref" line area; only treat pairs after "xref\n"
    if (match.index < 4) continue;
    // Stop once we hit trailer
    if (trailerMatch.index != null && match.index >= trailerMatch.index) break;
    const start = Number(match[1]);
    const count = Number(match[2]);
    const rowsStart = match.index + match[0].length + 1; // after newline
    for (let i = 0; i < count; i += 1) {
      const rowAt = rowsStart + i * 20;
      const row = text.slice(rowAt, rowAt + 20);
      if (row.length < 18) break;
      const offset = Number(row.slice(0, 10));
      const gen = Number(row.slice(11, 16));
      const flag = row[17];
      if (flag === "n" && Number.isFinite(offset)) {
        entries.set(`${start + i}/${gen}`, { kind: "abs", offset });
      }
    }
  }
  return { entries, root, prev };
}

async function parseXrefStreamSection(file: DiskFile, size: number, xrefOffset: number) {
  const head = await readSlice(file, xrefOffset, Math.min(16 * 1024, size - xrefOffset));
  const headText = head.toString("latin1");
  const objMatch = headText.match(/^\d+\s+\d+\s+obj\s*<<([\s\S]*?)>>/);
  if (!objMatch) return null;
  const dict = objMatch[1]!;
  if (!/\/Type\s*\/XRef/.test(dict)) return null;

  const wMatch = dict.match(/\/W\s*\[([^\]]+)\]/);
  if (!wMatch) return null;
  const widths = wMatch[1]!.trim().split(/\s+/).map(Number);
  if (widths.length < 3 || widths.some((n) => !Number.isFinite(n))) return null;

  const rootMatch = dict.match(/\/Root\s+(\d+)\s+(\d+)\s+R/);
  const prevMatch = dict.match(/\/Prev\s+(\d+)/);
  const sizeMatch = dict.match(/\/Size\s+(\d+)/);
  const indexMatch = dict.match(/\/Index\s*\[([^\]]+)\]/);
  const lengthMatch = dict.match(/\/Length\s+(\d+)/);
  if (!lengthMatch) return null;
  const streamLength = Number(lengthMatch[1]);
  const streamHeader = headText.indexOf("stream");
  if (streamHeader < 0) return null;
  let dataStart = xrefOffset + streamHeader + "stream".length;
  // PDF allows \r\n or \n after stream
  const after = headText.slice(streamHeader + 6, streamHeader + 8);
  if (after.startsWith("\r\n")) dataStart += 2;
  else if (after.startsWith("\n") || after.startsWith("\r")) dataStart += 1;

  let data = await readSlice(file, dataStart, streamLength);
  if (/\/Filter\s*\/FlateDecode/.test(dict)) {
    const { inflateSync } = await import("node:zlib");
    try {
      data = inflateSync(data);
    } catch {
      return null;
    }
  }

  const pairs: number[] = [];
  if (indexMatch) {
    const nums = indexMatch[1]!.trim().split(/\s+/).map(Number);
    for (let i = 0; i + 1 < nums.length; i += 2) pairs.push(nums[i]!, nums[i + 1]!);
  } else {
    pairs.push(0, Number(sizeMatch?.[1] ?? 0));
  }

  const entrySize = widths[0]! + widths[1]! + widths[2]!;
  const entries = new Map<
    string,
    { kind: "abs"; offset: number } | { kind: "stm"; stm: number; index: number }
  >();
  let cursor = 0;
  for (let p = 0; p + 1 < pairs.length; p += 2) {
    const start = pairs[p]!;
    const count = pairs[p + 1]!;
    for (let i = 0; i < count; i += 1) {
      const slice = data.subarray(cursor, cursor + entrySize);
      cursor += entrySize;
      if (slice.length < entrySize) break;
      let o = 0;
      const type = widths[0]! === 0 ? 1 : readInt(slice, o, widths[0]!);
      o += widths[0]!;
      const field1 = readInt(slice, o, widths[1]!);
      o += widths[1]!;
      const field2 = readInt(slice, o, widths[2]!);
      if (type === 1) {
        entries.set(`${start + i}/0`, { kind: "abs", offset: field1 });
      } else if (type === 2) {
        entries.set(`${start + i}/0`, { kind: "stm", stm: field1, index: field2 });
      }
    }
  }

  return {
    entries,
    root: rootMatch ? { obj: Number(rootMatch[1]), gen: Number(rootMatch[2]) } : null,
    prev: prevMatch ? Number(prevMatch[1]) : null,
  };
}

function readInt(buf: Buffer, offset: number, width: number) {
  if (width === 0) return 0;
  let value = 0;
  for (let i = 0; i < width; i += 1) value = (value << 8) | buf[offset + i]!;
  return value;
}

async function readPdfObject(
  file: DiskFile,
  size: number,
  entries: Map<
    string,
    { kind: "abs"; offset: number } | { kind: "stm"; stm: number; index: number }
  >,
  obj: number,
  gen: number
) {
  const entry = entries.get(`${obj}/${gen}`) ?? entries.get(`${obj}/0`);
  if (!entry) return null;
  if (entry.kind === "stm") {
    return readFromObjStm(file, size, entries, entry.stm, entry.index);
  }
  const max = Math.min(1024 * 1024, size - entry.offset);
  const buf = await readSlice(file, entry.offset, max);
  const text = buf.toString("latin1");
  const end = text.indexOf("endobj");
  const body = end >= 0 ? text.slice(0, end) : text;
  const dict = body.match(/obj\s*<<([\s\S]*?)>>/);
  return dict ? dict[1]! : body;
}

async function readFromObjStm(
  file: DiskFile,
  size: number,
  entries: Map<
    string,
    { kind: "abs"; offset: number } | { kind: "stm"; stm: number; index: number }
  >,
  stmObj: number,
  index: number
) {
  const stmEntry = entries.get(`${stmObj}/0`);
  if (!stmEntry || stmEntry.kind !== "abs") return null;
  const max = Math.min(2 * 1024 * 1024, size - stmEntry.offset);
  const buf = await readSlice(file, stmEntry.offset, max);
  const text = buf.toString("latin1");
  const dictMatch = text.match(/obj\s*<<([\s\S]*?)>>\s*stream/);
  if (!dictMatch) return null;
  const dict = dictMatch[1]!;
  const first = Number(dict.match(/\/First\s+(\d+)/)?.[1] ?? 0);
  const n = Number(dict.match(/\/N\s+(\d+)/)?.[1] ?? 0);
  const length = Number(dict.match(/\/Length\s+(\d+)/)?.[1] ?? 0);
  if (!length || !n) return null;
  const streamAt = text.indexOf("stream");
  if (streamAt < 0) return null;
  let dataStart = stmEntry.offset + streamAt + 6;
  const after = text.slice(streamAt + 6, streamAt + 8);
  if (after.startsWith("\r\n")) dataStart += 2;
  else if (after.startsWith("\n") || after.startsWith("\r")) dataStart += 1;
  let data = await readSlice(file, dataStart, length);
  if (/\/Filter\s*\/FlateDecode/.test(dict)) {
    const { inflateSync } = await import("node:zlib");
    try {
      data = inflateSync(data);
    } catch {
      return null;
    }
  }
  const decoded = data.toString("latin1");
  const header = decoded.slice(0, first);
  const pairs = header.trim().split(/\s+/).map(Number);
  // pairs: objnum offset objnum offset ...
  if (index * 2 + 1 >= pairs.length) return null;
  const objOffset = pairs[index * 2 + 1]!;
  const nextOffset = index * 2 + 3 < pairs.length ? pairs[index * 2 + 3]! : decoded.length - first;
  const body = decoded.slice(first + objOffset, first + nextOffset);
  const inner = body.match(/<<([\s\S]*?)>>/);
  return inner ? inner[1]! : body;
}
