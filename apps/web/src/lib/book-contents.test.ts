import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { OFFSET_BOOK, SCANNED_BOOK, TEXT_BOOK } from "@/test/book-fixtures";
import { textPdf, type FixturePage } from "@/test/pdf-fixture";
import {
  createScannedPageReader,
  itemsToLines,
  mapPdf,
  readPdfText,
  scannedMapPages,
  scannedPageImages,
  SCAN_FRONT_PAGES,
} from "@/lib/book-contents";

let dir = "";
const file = async (name: string, pages: FixturePage[]) => {
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
    expect(read).toHaveBeenCalledWith(path, [2, 3], 4);
    expect(map.scannedPages).toEqual([3]);
    expect(map.candidates.map((candidate) => candidate.title)).toEqual([
      "Fish Stew",
      "Potato Bake",
      "Rice Pudding",
    ]);
  });
});

const SCAN = { lines: [], images: [{ width: 120, height: 160, x: 0, y: 0 }] };
const scans = (count: number) => Array.from({ length: count }, () => SCAN);
const lines =
  (...pages: string[][]) =>
  async (images: string[]) =>
    images.map((_, at) => ({ page: at + 1, lines: pages[at] ?? [] }));

describe("scannedMapPages", () => {
  it("takes the first scans of the front matter and the last scans of the back", () => {
    const all = Array.from({ length: 300 }, (_, at) => at + 1);
    expect(scannedMapPages(all, 300)).toEqual({
      front: [1, 2, 3, 4],
      back: [297, 298, 299, 300],
    });
  });

  it("skips text pages and never sends the middle of the book", () => {
    expect(scannedMapPages([2, 5, 45, 90, 140, 199], 200)).toEqual({
      front: [2, 5],
      back: [140, 199],
    });
  });

  it("does not send a short book's pages twice", () => {
    expect(scannedMapPages([1, 2, 3], 3)).toEqual({ front: [1, 2, 3], back: [] });
  });
});

describe("createScannedPageReader", () => {
  const images = vi.fn(async (_path: string, pages: number[]) =>
    Object.fromEntries(pages.map((page) => [page, `data:image/png;base64,p${page}`]))
  );

  it("reads nothing without AI Gateway and says why", async () => {
    const report = vi.fn();
    const read = createScannedPageReader({ images, env: {}, report });
    expect(await read("book.pdf", [1, 2], 2)).toEqual({});
    expect(report).toHaveBeenCalledWith("AI Gateway is not configured");
    expect(images).not.toHaveBeenCalled();
  });

  it("stops at the front when it holds a contents page", async () => {
    const vision = vi.fn(lines([], ["Contents", "Soup 12", "Stew 14"]));
    const read = createScannedPageReader({ images, vision });
    expect(await read("book.pdf", [1, 2, 3, 99, 100], 100)).toEqual({
      2: ["Contents", "Soup 12", "Stew 14"],
    });
    expect(vision).toHaveBeenCalledTimes(1);
    expect(vision.mock.calls[0]![0]).toEqual([
      "data:image/png;base64,p1",
      "data:image/png;base64,p2",
      "data:image/png;base64,p3",
    ]);
  });

  it("reads the back for an index when the front has no contents", async () => {
    const vision = vi
      .fn()
      .mockImplementationOnce(lines(["A Cookbook"]))
      .mockImplementationOnce(lines(["Index", "Soup, 12"]));
    const read = createScannedPageReader({ images, vision });
    expect(await read("book.pdf", [1, 99], 100)).toEqual({
      1: ["A Cookbook"],
      99: ["Index", "Soup, 12"],
    });
    expect(vision.mock.calls[1]![0]).toEqual(["data:image/png;base64,p99"]);
  });

  it("degrades to no reads when vision fails", async () => {
    const report = vi.fn();
    const vision = vi.fn(async () => {
      throw new Error("gateway down");
    });
    const read = createScannedPageReader({ images, vision, report });
    expect(await read("book.pdf", [1], 1)).toEqual({});
    expect(report).toHaveBeenCalledWith("vision read failed", expect.any(Error));
  });
});

describe("fully scanned book", () => {
  it("pulls each scan's embedded page image", async () => {
    const path = await file("scan-images.pdf", [["Title page"], SCAN, SCAN]);
    const found = await scannedPageImages(path, [2, 3]);
    expect(Object.keys(found)).toEqual(["2", "3"]);
    expect(found[2]).toMatch(/^data:image\/png;base64,/);
  });

  it("maps candidates from a vision read of the contents scan", async () => {
    const path = await file("scanned-book.pdf", scans(12));
    const vision = vi.fn(
      lines(
        ["A Kitchen Book"],
        [],
        ["Contents", "Suppers", "Tomato Soup 4", "Roast Chicken 6", "Baking", "Shortbread 9"]
      )
    );
    const map = await mapPdf(path, createScannedPageReader({ vision }));
    expect(vision).toHaveBeenCalledTimes(1);
    expect(vision.mock.calls[0]![0]).toHaveLength(SCAN_FRONT_PAGES);
    expect(map).toEqual({
      source: "contents",
      offset: 0,
      calibrated: false,
      mapPages: [3],
      scannedPages: [2, 4, 5, 6, 7, 8, 9, 10, 11, 12],
      candidates: [
        { id: "4-tomato-soup", title: "Tomato Soup", group: "Suppers", printedPage: 4, pdfPage: 4 },
        {
          id: "6-roast-chicken",
          title: "Roast Chicken",
          group: "Suppers",
          printedPage: 6,
          pdfPage: 6,
        },
        { id: "9-shortbread", title: "Shortbread", group: "Baking", printedPage: 9, pdfPage: 9 },
      ],
    });
  });

  it("still maps (to nothing) when the vision read fails", async () => {
    const path = await file("scanned-fail.pdf", scans(3));
    const vision = vi.fn(async () => {
      throw new Error("timeout");
    });
    const map = await mapPdf(path, createScannedPageReader({ vision, report: () => undefined }));
    expect(map).toMatchObject({ source: "none", candidates: [], scannedPages: [1, 2, 3] });
  });
});
