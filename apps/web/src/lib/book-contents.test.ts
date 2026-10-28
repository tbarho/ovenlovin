import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { OFFSET_BOOK, SCANNED_BOOK, TEXT_BOOK } from "@/test/book-fixtures";
import { textPdf } from "@/test/pdf-fixture";
import { itemsToLines, mapPdf, readPdfText } from "@/lib/book-contents";

let dir = "";
const file = async (name: string, pages: string[][]) => {
  const path = join(dir, name);
  await writeFile(path, textPdf(pages));
  return path;
};

beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), "ovenlovin-contents-"));
});

afterAll(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe("readPdfText", () => {
  it("pulls lines in reading order and leaves scanned pages empty", async () => {
    const pages = await readPdfText(await file("scanned.pdf", SCANNED_BOOK));
    expect(pages.map((page) => page.lines.length)).toEqual([7, 0, 0, 7]);
    expect(pages[0]!.lines.slice(0, 3)).toEqual(["Fish Stew", "Serves 4", "1 lb white fish"]);
  });
});

describe("itemsToLines", () => {
  it("joins items on one baseline left to right", () => {
    expect(
      itemsToLines([
        { str: "12", transform: [1, 0, 0, 1, 400, 700] },
        { str: "Soup ....", transform: [1, 0, 0, 1, 72, 700.6] },
        { str: "Contents", transform: [1, 0, 0, 1, 72, 740] },
        { str: " ", transform: [1, 0, 0, 1, 72, 600] },
      ])
    ).toEqual(["Contents", "Soup .... 12"]);
  });
});

describe("mapPdf golden candidate lists", () => {
  it("text-layer book", async () => {
    expect(await mapPdf(await file("text.pdf", TEXT_BOOK))).toEqual({
      source: "contents",
      offset: 0,
      calibrated: true,
      mapPages: [1],
      scannedPages: [],
      candidates: [
        {
          id: "2-buttermilk-pancakes",
          title: "Buttermilk Pancakes",
          group: "Breakfast",
          printedPage: 2,
          pdfPage: 2,
        },
        {
          id: "3-oat-porridge",
          title: "Oat Porridge",
          group: "Breakfast",
          printedPage: 3,
          pdfPage: 3,
        },
        { id: "4-tomato-soup", title: "Tomato Soup", group: "Suppers", printedPage: 4, pdfPage: 4 },
        {
          id: "5-roast-chicken",
          title: "Roast Chicken",
          group: "Suppers",
          printedPage: 5,
          pdfPage: 5,
        },
      ],
    });
  });

  it("book with a front matter offset", async () => {
    expect(await mapPdf(await file("offset.pdf", OFFSET_BOOK))).toEqual({
      source: "contents",
      offset: 3,
      calibrated: true,
      mapPages: [3],
      scannedPages: [],
      candidates: [
        { id: "1-lemon-bars", title: "Lemon Bars", group: "Baking", printedPage: 1, pdfPage: 4 },
        { id: "2-shortbread", title: "Shortbread", group: "Baking", printedPage: 2, pdfPage: 5 },
        {
          id: "3-ginger-snaps",
          title: "Ginger Snaps",
          group: "Baking",
          printedPage: 3,
          pdfPage: 6,
        },
      ],
    });
  });

  it("scanned book falls back to per-page titles and lists the scans", async () => {
    expect(await mapPdf(await file("scanned-map.pdf", SCANNED_BOOK))).toEqual({
      source: "pages",
      offset: 0,
      calibrated: false,
      mapPages: [],
      scannedPages: [2, 3],
      candidates: [
        { id: "p1-fish-stew", title: "Fish Stew", group: null, printedPage: null, pdfPage: 1 },
        {
          id: "p4-rice-pudding",
          title: "Rice Pudding",
          group: null,
          printedPage: null,
          pdfPage: 4,
        },
      ],
    });
  });

  it("sends only scanned pages to the scanned-page reader", async () => {
    const read = vi.fn(async () => ({
      2: ["Potato Bake", "2 potatoes", "1 cup cream", "1 cup cheese"],
    }));
    const path = await file("scanned-read.pdf", SCANNED_BOOK);
    const map = await mapPdf(path, read);
    expect(read).toHaveBeenCalledWith(path, [2, 3]);
    expect(map.scannedPages).toEqual([3]);
    expect(map.candidates.map((candidate) => candidate.title)).toEqual([
      "Fish Stew",
      "Potato Bake",
      "Rice Pudding",
    ]);
  });
});
