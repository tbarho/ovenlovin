import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { PDFDict, PDFDocument, PDFName } from "pdf-lib";
import { PRINT_FIXTURE_ID } from "../../src/test/print-fixture";

/** Node 20 CI lacks Promise.withResolvers; pdfjs-dist needs it. */
if (typeof (Promise as any).withResolvers !== "function") {
  (Promise as any).withResolvers = function <T>() {
    let resolve!: (value: T | PromiseLike<T>) => void;
    let reject!: (reason?: unknown) => void;
    const promise = new Promise<T>((res, rej) => {
      resolve = res;
      reject = rej;
    });
    return { promise, resolve, reject };
  };
}

/** Names of fonts whose files ride inside the PDF (FontFile, FontFile2, FontFile3). */
async function embeddedFonts(bytes: Uint8Array) {
  const doc = await PDFDocument.load(bytes);
  const keys = ["FontFile", "FontFile2", "FontFile3"].map((key) => PDFName.of(key));
  return doc.context.enumerateIndirectObjects().reduce((memo: string[], [, object]) => {
    if (!(object instanceof PDFDict)) return memo;
    if (object.get(PDFName.of("Type")) !== PDFName.of("FontDescriptor")) return memo;
    if (!keys.some((key) => object.has(key))) return memo;
    return [...memo, String(object.get(PDFName.of("FontName")))];
  }, []);
}

const shotRoot = process.env.E2E_SHOT_DIR
  ? path.resolve(process.env.E2E_SHOT_DIR)
  : path.resolve(__dirname, "../../../../e2e-artifacts/kitchen/book-print");

/** Every laid-out page whose content spills: clipped scroll or anything past the page edge. */
async function overflows(page: Page) {
  return page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>(".print-sheet")].flatMap((sheet) => {
      const book = sheet.querySelector<HTMLElement>(".book-page")!;
      const edge = book.getBoundingClientRect();
      const bad = [...book.querySelectorAll<HTMLElement>("*")].filter((el) => {
        const box = el.getBoundingClientRect();
        if (!box.width && !box.height) return false;
        const clips = getComputedStyle(el).overflowY !== "visible";
        const spills = clips && el.scrollHeight > el.clientHeight + 1;
        const wide = clips && el.scrollWidth > el.clientWidth + 1;
        const outside =
          box.bottom > edge.bottom + 0.5 ||
          box.right > edge.right + 0.5 ||
          box.top < edge.top - 0.5 ||
          box.left < edge.left - 0.5;
        return spills || wide || outside;
      });
      if (!bad.length) return [];
      return [
        {
          page: Number(sheet.dataset.page),
          kind: book.className,
          what: bad.slice(0, 3).map((el) => el.className || el.tagName),
        },
      ];
    })
  );
}

/** The contents entries exactly as the model laid them out. */
async function contentsOf(page: Page) {
  return page.evaluate(() =>
    [...document.querySelectorAll(".book-page--contents .book-toc li")].map((li) => ({
      title: li.querySelector(".book-toc-title")!.textContent!.trim(),
      page: Number(li.querySelector(".book-toc-page")!.textContent),
    }))
  );
}

async function pdfText(bytes: Uint8Array) {
  const pdfjs: any = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const doc = await pdfjs.getDocument({ data: bytes.slice(), isEvalSupported: false }).promise;
  try {
    return await Promise.all(
      Array.from({ length: doc.numPages }, async (_, i) => {
        const content = await (await doc.getPage(i + 1)).getTextContent();
        return content.items
          .map((item: any) => item.str)
          .join(" ")
          .replace(/\s+/g, " ");
      })
    );
  } finally {
    if (typeof doc.destroy === "function") await doc.destroy();
  }
}

const squash = (text: string) => text.replace(/\s+/g, "");

/** Starts the real book_pdf job and waits on the same progress route the Print sheet polls. */
async function makePdf(api: APIRequestContext, cookbookId: string, mode: "home" | "shop") {
  const started = await api.post(`/api/v1/cookbooks/${cookbookId}/pdf`, { data: { mode } });
  expect(started.status(), await started.text()).toBe(202);
  let view = await started.json();
  const parts = new Set<number>();
  await expect
    .poll(
      async () => {
        view = await (await api.get(`/api/v1/cookbooks/${cookbookId}/pdf/${view.jobId}`)).json();
        parts.add(view.done);
        if (view.status === "failed") throw new Error(view.error);
        return view.status;
      },
      { timeout: 540_000, intervals: [1_000, 2_000, 3_000] }
    )
    .toBe("ready");
  const file = await api.get(view.downloadUrl);
  expect(file.status()).toBe(200);
  expect(file.headers()["content-type"]).toContain("application/pdf");
  return { view, bytes: new Uint8Array(await file.body()) };
}

async function proveBook(page: Page, cookbookId: string, label: string) {
  await page.goto(`/print/cookbooks/${cookbookId}?mode=home`);
  const sheet = page.locator(".print-book");
  await expect(sheet).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  const modelPages = Number(await sheet.getAttribute("data-page-count"));
  expect(await page.locator(".print-sheet").count()).toBe(modelPages);
  mkdirSync(shotRoot, { recursive: true });
  await page
    .locator(".print-sheet")
    .first()
    .screenshot({ path: path.join(shotRoot, `${label}-cover.png`) });

  expect(await overflows(page), "pages that overflow the Letter trim").toEqual([]);
  const contents = await contentsOf(page);
  expect(contents.length).toBeGreaterThan(0);

  const { view, bytes } = await makePdf(page.request, cookbookId, "home");
  expect(view.total).toBeGreaterThan(1);
  writeFileSync(path.join(shotRoot, `${label}.pdf`), bytes);

  const doc = await PDFDocument.load(bytes);
  expect(doc.getPageCount(), "PDF pages = model pages").toBe(modelPages);
  const { width, height } = doc.getPage(0).getSize();
  expect([Math.round(width), Math.round(height)]).toEqual([612, 792]);

  const text = await pdfText(bytes);
  const mismatched = contents.filter((entry) => {
    const onPage = squash(text[entry.page - 1] ?? "");
    return !onPage.includes(squash(entry.title));
  });
  expect(mismatched, "contents entries whose page in the PDF lacks the title").toEqual([]);
  return { modelPages, view };
}

test.describe("book print PDF", () => {
  test("a kitchen cookbook prints at Letter with matching pages, contents, and fonts", async ({
    page,
  }) => {
    test.setTimeout(300_000);
    await page.goto("/recipes");
    const href = await page
      .getByRole("link", { name: /weeknight dinners/i })
      .first()
      .getAttribute("href");
    const cookbookId = new URL(href!, "http://x").searchParams.get("cookbook")!;
    expect(cookbookId).toBeTruthy();

    await proveBook(page, cookbookId, "weeknight");

    // Print shop: same pages, Letter trim plus bleed, crop marks, embedded fonts.
    await page.goto(`/print/cookbooks/${cookbookId}?mode=shop`);
    await expect(page.locator(".print-marks").first()).toBeVisible();
    await page
      .locator(".print-sheet")
      .nth(0)
      .screenshot({ path: path.join(shotRoot, "shop-cover.png") });
    const shop = await makePdf(page.request, cookbookId, "shop");
    writeFileSync(path.join(shotRoot, "weeknight-shop.pdf"), shop.bytes);
    const doc = await PDFDocument.load(shop.bytes);
    const first = doc.getPage(0);
    expect(first.getSize()).toEqual({ width: 666, height: 846 });
    expect(first.getTrimBox()).toEqual({ x: 27, y: 27, width: 612, height: 792 });
    expect(first.getBleedBox()).toEqual({ x: 18, y: 18, width: 630, height: 810 });
    const fonts = await embeddedFonts(shop.bytes);
    expect(
      fonts.some((name) => /geist/i.test(name)),
      fonts.join(", ")
    ).toBe(true);

    // The reader's Print sheet: choose, watch it finish, download.
    await page.goto(`/cookbooks/${cookbookId}/book`);
    await page.getByRole("button", { name: "Print" }).click();
    await page.getByRole("radio", { name: /at home/i }).click();
    await page.getByRole("button", { name: /make the pdf/i }).click();
    const download = page.getByRole("link", { name: /download pdf/i });
    await expect(download).toBeVisible({ timeout: 120_000 });
    await page.screenshot({ path: path.join(shotRoot, "print-sheet-ready.png") });
    const [file] = await Promise.all([page.waitForEvent("download"), download.click()]);
    expect(file.suggestedFilename()).toMatch(/-home\.pdf$/);
  });

  test("the 300-recipe fixture completes via chunks", async ({ page }) => {
    test.setTimeout(600_000);
    const { modelPages, view } = await proveBook(page, PRINT_FIXTURE_ID, "fixture-300");
    expect(modelPages).toBeGreaterThan(600);
    expect(view.total).toBeGreaterThan(15);
  });
});
