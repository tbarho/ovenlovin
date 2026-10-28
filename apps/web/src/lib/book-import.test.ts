import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { packedPdf, pageObjects, pdfBytes, plainPdf, xrefPdf } from "@/test/pdf-fixture";
import {
  bookBlobStoreHost,
  countPdfPages,
  countPdfPagesOnDisk,
  isBookBlobUrl,
  sha256Hex,
} from "./book-import";

const household = "22222222-2222-4222-8222-222222222222";
const store = "abc.public.blob.vercel-storage.com";
const blob = (path: string) => `https://${store}${path}`;

describe("countPdfPages", () => {
  it("reads the page tree count", () => {
    expect(countPdfPages(plainPdf(3))).toBe(3);
  });

  it("reads a page tree packed in a compressed object stream", () => {
    expect(countPdfPages(packedPdf(412))).toBe(412);
  });

  it("falls back to counting page leaves when there is no tree count", () => {
    expect(countPdfPages(pdfBytes(`%PDF-1.4\n${pageObjects(2)}%%EOF\n`))).toBe(2);
  });

  it("returns 0 for a file that is not a PDF", () => {
    expect(countPdfPages(pdfBytes("PK\u0003\u0004 epub"))).toBe(0);
  });
});

describe("countPdfPagesOnDisk", () => {
  let dir = "";

  afterEach(async () => {
    if (dir) await rm(dir, { recursive: true, force: true });
    dir = "";
  });

  it("resolves Count through a classic xref root", async () => {
    dir = await mkdtemp(join(tmpdir(), "ovenlovin-pdf-"));
    const path = join(dir, "book.pdf");
    await writeFile(path, xrefPdf(7));
    expect(await countPdfPagesOnDisk(path)).toBe(7);
  });

  it("falls back to full parse for small plain PDFs without xref", async () => {
    dir = await mkdtemp(join(tmpdir(), "ovenlovin-pdf-"));
    const path = join(dir, "book.pdf");
    await writeFile(path, plainPdf(3));
    expect(await countPdfPagesOnDisk(path)).toBe(3);
  });
});

describe("bookBlobStoreHost", () => {
  it("prefers BLOB_STORE_HOST", () => {
    expect(bookBlobStoreHost({ BLOB_STORE_HOST: "My.Public.Blob.Vercel-Storage.com" })).toBe(
      "my.public.blob.vercel-storage.com"
    );
  });

  it("derives the host from the read-write token", () => {
    expect(bookBlobStoreHost({ BLOB_READ_WRITE_TOKEN: "vercel_blob_rw_AbC123_secretpart" })).toBe(
      "abc123.public.blob.vercel-storage.com"
    );
  });
});

describe("isBookBlobUrl", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("accepts this household's book uploads on our store", () => {
    vi.stubEnv("BLOB_STORE_HOST", store);
    expect(isBookBlobUrl(blob(`/books/${household}/x-Ab3.pdf`), household)).toBe(true);
  });

  it("rejects other hosts, other households, and other folders", () => {
    vi.stubEnv("BLOB_STORE_HOST", store);
    expect(isBookBlobUrl(`https://evil.example/books/${household}/x.pdf`, household)).toBe(false);
    expect(
      isBookBlobUrl(
        `https://evil.public.blob.vercel-storage.com/books/${household}/x.pdf`,
        household
      )
    ).toBe(false);
    expect(isBookBlobUrl(blob("/books/someone-else/x.pdf"), household)).toBe(false);
    expect(isBookBlobUrl(blob(`/recipes/${household}/x.pdf`), household)).toBe(false);
    expect(isBookBlobUrl("not a url", household)).toBe(false);
  });
});

describe("sha256Hex", () => {
  it("matches the known digest", () => {
    expect(sha256Hex(pdfBytes("abc"))).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
    );
  });
});
