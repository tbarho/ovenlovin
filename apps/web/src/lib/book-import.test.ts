import { describe, expect, it } from "vitest";
import { packedPdf, pageObjects, pdfBytes, plainPdf } from "@/test/pdf-fixture";
import { countPdfPages, isBookBlobUrl, sha256Hex } from "./book-import";

const household = "22222222-2222-4222-8222-222222222222";
const blob = (path: string) => `https://abc.public.blob.vercel-storage.com${path}`;

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

describe("isBookBlobUrl", () => {
  it("accepts this household's book uploads on Vercel Blob", () => {
    expect(isBookBlobUrl(blob(`/books/${household}/x-Ab3.pdf`), household)).toBe(true);
  });

  it("rejects other hosts, other households, and other folders", () => {
    expect(isBookBlobUrl(`https://evil.example/books/${household}/x.pdf`, household)).toBe(false);
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
