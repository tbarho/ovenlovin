import { describe, expect, it } from "vitest";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { mergeChunks, pdfPageCount } from "./book-pdf";

async function chunk(pages: number, w = 612, h = 792) {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  Array.from({ length: pages }).forEach((_, i) => {
    const page = doc.addPage([w, h]);
    page.drawText(`page ${i + 1}`, { x: 50, y: 50, font, size: 12 });
  });
  return doc.save();
}

describe("mergeChunks", () => {
  it("keeps every page in chunk order", async () => {
    const bytes = await mergeChunks([await chunk(3), await chunk(2)], { mode: "home", title: "T" });
    expect(await pdfPageCount(bytes)).toBe(5);
    const doc = await PDFDocument.load(bytes);
    expect(doc.getTitle()).toBe("T");
    expect(doc.getCreator()).toBe("OvenLovin");
    expect(doc.getPage(0).getTrimBox()).toEqual(doc.getPage(0).getMediaBox());
  });

  it("marks trim and bleed for a print shop", async () => {
    const sheet = await chunk(1, 9.25 * 72, 11.75 * 72);
    const doc = await PDFDocument.load(await mergeChunks([sheet], { mode: "shop", title: "T" }));
    const page = doc.getPage(0);
    expect(page.getTrimBox()).toEqual({ x: 27, y: 27, width: 612, height: 792 });
    expect(page.getBleedBox()).toEqual({ x: 18, y: 18, width: 630, height: 810 });
  });
});
