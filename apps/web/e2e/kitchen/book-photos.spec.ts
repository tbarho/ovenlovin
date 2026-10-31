import { expect, test, type Page } from "@playwright/test";

/**
 * Book photos are shown whole: aspect-fit on a paper mat, never cropped.
 * For every raster photo on screen, the painted image (contain math on the
 * content box) keeps the photo's natural ratio and fits inside its box.
 */
type Shot = { src: string; fit: string; natural: number; painted: number; fits: boolean };

async function photosOnScreen(page: Page): Promise<Shot[]> {
  return page.evaluate(() =>
    [...document.querySelectorAll<HTMLImageElement>(".book-page img")]
      .filter((img) => /\.(jpe?g|png|webp)(\?|$)/i.test(img.currentSrc || img.src))
      .filter((img) => img.complete && img.naturalWidth > 0 && img.getClientRects().length > 0)
      .map((img) => {
        const rect = img.getBoundingClientRect();
        const style = getComputedStyle(img);
        const px = (value: string) => parseFloat(value) || 0;
        const w = rect.width - px(style.paddingLeft) - px(style.paddingRight);
        const h = rect.height - px(style.paddingTop) - px(style.paddingBottom);
        const scale =
          style.objectFit === "contain"
            ? Math.min(w / img.naturalWidth, h / img.naturalHeight)
            : Math.max(w / img.naturalWidth, h / img.naturalHeight);
        const pw = img.naturalWidth * scale;
        const ph = img.naturalHeight * scale;
        const frame = img.parentElement!.getBoundingClientRect();
        const inFrame =
          rect.left >= frame.left - 0.5 &&
          rect.right <= frame.right + 0.5 &&
          rect.top >= frame.top - 0.5 &&
          rect.bottom <= frame.bottom + 0.5;
        return {
          src: (img.currentSrc || img.src).split("/").pop()!,
          fit: style.objectFit,
          natural: img.naturalWidth / img.naturalHeight,
          painted: pw / ph,
          fits: inFrame && pw <= w + 0.5 && ph <= h + 0.5,
        };
      })
  );
}

function expectWhole(shots: Shot[]) {
  for (const shot of shots) {
    expect(shot.fit, `${shot.src} object-fit`).toBe("contain");
    expect(Math.abs(shot.painted / shot.natural - 1), `${shot.src} ratio`).toBeLessThan(0.01);
    expect(shot.fits, `${shot.src} painted inside its frame`).toBe(true);
  }
}

async function weeknightId(page: Page) {
  await page.goto("/recipes");
  const href = await page
    .getByRole("link", { name: /weeknight dinners/i })
    .first()
    .getAttribute("href");
  const id = new URL(href!, "http://x").searchParams.get("cookbook");
  expect(id).toBeTruthy();
  return id!;
}

const FIXTURES = ["photo-portrait.jpg", "photo-landscape.jpg", "photo-square.jpg"];

test.describe("book photos are shown whole", () => {
  test("print route: every photo keeps its aspect", async ({ page }) => {
    const id = await weeknightId(page);
    await page.goto(`/print/cookbooks/${id}?mode=home`);
    await expect(page.locator(".print-book")).toBeVisible();
    await page.waitForFunction(() =>
      [...document.images].every((img) => img.complete && img.naturalWidth > 0)
    );
    const shots = await photosOnScreen(page);
    for (const name of FIXTURES) {
      expect(
        shots.some((shot) => shot.src === name),
        `${name} printed`
      ).toBe(true);
    }
    expectWhole(shots);

    await page.goto(`/print/cookbooks/${id}?mode=shop`);
    await page.waitForFunction(() =>
      [...document.images].every((img) => img.complete && img.naturalWidth > 0)
    );
    expectWhole(await photosOnScreen(page));
  });

  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 390, height: 844 },
  ]) {
    test(`reader at ${viewport.width}: every photo keeps its aspect`, async ({ page }) => {
      test.setTimeout(120_000);
      await page.setViewportSize(viewport);
      const id = await weeknightId(page);
      await page.goto(`/cookbooks/${id}/book`);
      await expect(page.locator(".book-page").first()).toBeVisible();
      const seen = new Set<string>();
      const next = page.getByRole("button", { name: "Next page" });
      for (let turn = 0; turn < 80; turn += 1) {
        await page.waitForTimeout(750);
        const shots = await photosOnScreen(page);
        expectWhole(shots);
        shots.forEach((shot) => seen.add(shot.src));
        if (await next.isDisabled()) break;
        await next.click();
      }
      for (const name of FIXTURES) expect(seen.has(name), `${name} shown`).toBe(true);
    });
  }
});
