import { PDFDocument } from "pdf-lib";
import { PRINT_SPEC, printSheet, type PrintMode } from "@ovenlovin/core/book";

/** Points per inch in PDF space. */
const PT = 72;

import type { LowRes } from "@/lib/book-pdf-types";

export type { LowRes } from "@/lib/book-pdf-types";
export type RenderedChunk = { bytes: Uint8Array; sha: string; lowRes: LowRes[] };

/**
 * Headless Chromium. On Vercel / Lambda the serverless build of Chromium;
 * anywhere else Playwright's own (or CHROMIUM_PATH). Same job either way.
 */
export async function launchChromium() {
  const { chromium } = await import("playwright-core");
  if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME) {
    const serverless = (await import("@sparticuz/chromium")).default;
    return chromium.launch({
      executablePath: await serverless.executablePath(),
      args: serverless.args,
      headless: true,
    });
  }
  return chromium.launch({
    headless: true,
    executablePath: process.env.CHROMIUM_PATH || undefined,
  });
}

/** Every font loaded and every photo decoded before Chromium prints. */
async function settle(page: any) {
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all(
      [...document.images].map((img) => (img.complete ? null : img.decode().catch(() => null)))
    );
    // next/font can still be swapping after fonts.ready; wait for Geist on body.
    const deadline = Date.now() + 15_000;
    while (Date.now() < deadline) {
      if (/geist/i.test(getComputedStyle(document.body).fontFamily)) break;
      await new Promise((r) => setTimeout(r, 100));
    }
  });
}

/** Photos that print below `minDpi` at the size they sit on the page. */
async function lowResPhotos(page: any, minDpi: number): Promise<LowRes[]> {
  return page.evaluate((min: number) => {
    return [...document.querySelectorAll<HTMLElement>(".print-sheet")].flatMap((sheet) =>
      [...sheet.querySelectorAll("img")].reduce((memo: any[], img) => {
        const box = img.getBoundingClientRect();
        if (!img.naturalWidth || !box.width) return memo;
        const scale = Math.max(box.width / img.naturalWidth, box.height / img.naturalHeight);
        const dpi = Math.round(96 / scale);
        if (dpi >= min) return memo;
        return [...memo, { page: Number(sheet.dataset.page), dpi }];
      }, [])
    );
  }, minDpi);
}

/** One page range of the print route to PDF bytes, with the book fingerprint it rendered. */
export async function renderChunk(
  browser: any,
  url: string,
  headers: Record<string, string> = {}
): Promise<RenderedChunk> {
  const context = await browser.newContext({ extraHTTPHeaders: headers });
  try {
    const page = await context.newPage();
    const response = await page.goto(url, { waitUntil: "networkidle", timeout: 45_000 });
    if (!response?.ok()) throw new Error(`Print page answered ${response?.status() ?? "nothing"}`);
    await settle(page);
    const sha = await page.getAttribute(".print-book", "data-book-sha");
    const lowRes = await lowResPhotos(page, PRINT_SPEC.minDpi);
    await page.emulateMedia({ media: "print" });
    const bytes = await page.pdf({ preferCSSPageSize: true, printBackground: true });
    return { bytes: new Uint8Array(bytes), sha: sha ?? "", lowRes };
  } finally {
    await context.close();
  }
}

export async function pdfPageCount(bytes: Uint8Array) {
  return (await PDFDocument.load(bytes)).getPageCount();
}

/**
 * Chunk PDFs into one book, in order. A print shop copy carries TrimBox and
 * BleedBox so the shop's RIP finds the cut line without guessing.
 */
export async function mergeChunks(
  chunks: Uint8Array[],
  { mode, title }: { mode: PrintMode; title: string }
) {
  const out = await PDFDocument.create();
  await chunks.reduce(async (previous, bytes) => {
    await previous;
    const source = await PDFDocument.load(bytes);
    const pages = await out.copyPages(source, source.getPageIndices());
    pages.forEach((page) => out.addPage(page));
  }, Promise.resolve());

  if (mode === "shop") {
    const { pad } = printSheet(mode);
    const s = PRINT_SPEC;
    const edge = pad - s.bleed;
    out.getPages().forEach((page) => {
      page.setTrimBox(pad * PT, pad * PT, s.trimW * PT, s.trimH * PT);
      page.setBleedBox(
        edge * PT,
        edge * PT,
        (s.trimW + 2 * s.bleed) * PT,
        (s.trimH + 2 * s.bleed) * PT
      );
    });
  }

  out.setTitle(title);
  out.setCreator("OvenLovin");
  out.setProducer("OvenLovin");
  return out.save();
}
