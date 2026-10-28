import { expect, test, type Page } from "@playwright/test";
import path from "node:path";

const JOB = "00000000-0000-4000-8000-00000000b003";
const WIDTHS = [1440, 375, 320] as const;
const shotRoot = process.env.E2E_SHOT_DIR
  ? path.resolve(process.env.E2E_SHOT_DIR)
  : path.resolve(__dirname, "../../../../e2e-artifacts/kitchen/book-shot");

/** A tiny PNG page photo. The vision read is mocked, so any image bytes do. */
function photoFixture(name: string) {
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
    "base64"
  );
  return { name, mimeType: "image/png", buffer: png };
}

async function noOverflow(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth
  );
  expect(overflow).toBeLessThanOrEqual(0);
}

test.describe("paper book shot list", () => {
  test("contents photos to shot list to a recipe in the cookbook", async ({ page }) => {
    test.setTimeout(120_000);

    // The page photo read is the usual multi-page photo import, mocked here.
    await page.route("**/api/v1/recipes/import/photo", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          title: "Short ribs",
          servings: 4,
          ingredients: [{ rawText: "2 lb short ribs" }, { rawText: "1 onion" }],
          steps: [{ text: "Braise low and slow." }],
          images: [],
          source: {
            type: "photo",
            importerName: "photo-importer",
            importerVersion: "0.1.0",
            rawExtractionJson: { ocrQuality: "good" },
          },
          overallConfidence: 0.95,
          needsReview: false,
          reviewReasons: [],
          uncertainFields: [],
          allergenClassifications: [],
          preview: true,
        }),
      });
    });

    for (const width of WIDTHS) {
      await page.setViewportSize({ width, height: width === 1440 ? 900 : 844 });
      await page.goto(`/recipes/books/${JOB}`);
      await expect(page.getByRole("heading", { name: "A Paper Kitchen" })).toBeVisible();
      await expect(page.getByText("p. 112 Short ribs")).toBeVisible();
      await expect(page.getByText("p. 140 Corn bread")).toBeVisible();
      await noOverflow(page);
      await page.screenshot({
        path: path.join(shotRoot, `${width}-shot-list.png`),
        fullPage: true,
      });
    }
    await page.setViewportSize({ width: 1440, height: 900 });

    // The shelf tile says how many are photographed.
    await page.goto("/recipes");
    const tile = page.getByRole("link", { name: /A Paper Kitchen/ });
    await expect(tile).toContainText("0 of 2 photographed");

    // Photograph the first recipe: two page photos through the usual import.
    await tile.click();
    await page.getByRole("listitem").filter({ hasText: "Short ribs" }).getByRole("button").click();
    const sheet = page.getByRole("dialog", { name: "Short ribs" });
    await sheet
      .locator("input[multiple]")
      .setInputFiles([photoFixture("ribs-1.png"), photoFixture("ribs-2.png")]);
    await sheet.getByRole("button", { name: "Read 2 pages" }).click();

    const review = page.getByRole("dialog", { name: "Short ribs" });
    await expect(review.getByLabel("Title")).toHaveValue("Short ribs", { timeout: 30_000 });
    await review.getByRole("button", { name: "Save recipe" }).click();
    await expect(review).toHaveCount(0, { timeout: 30_000 });

    // The shot list marks it saved; the cookbook holds it in book order.
    const saved = page.getByRole("region", { name: "Saved" });
    await expect(saved.getByRole("link", { name: "Short ribs" })).toBeVisible();
    await expect(
      page.getByRole("region", { name: "Still to photograph" }).getByText("p. 140 Corn bread")
    ).toBeVisible();
    await page.getByRole("link", { name: "Open the cookbook" }).click();
    await page.waitForURL(/\/recipes\?cookbook=/, { timeout: 30_000 });
    await expect(page.getByRole("heading", { name: "A Paper Kitchen" })).toBeVisible();
    await page
      .getByRole("link", { name: /Short ribs/ })
      .first()
      .click();
    await page.waitForURL(/\/recipes\/[0-9a-f-]{36}/, { timeout: 30_000 });
    await expect(page.locator(".book-attribution")).toHaveText("From A Paper Kitchen, p. 112");
  });
});
