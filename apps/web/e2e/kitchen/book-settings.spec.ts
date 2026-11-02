import { expect, test, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import path from "node:path";

const shotRoot = path.resolve(__dirname, "../../../../e2e-artifacts/kitchen/book-settings");

async function weekendId(page: Page) {
  await page.goto("/recipes");
  const href = await page
    .getByRole("link", { name: /weekend treats/i })
    .first()
    .getAttribute("href");
  const id = new URL(href!, "http://x").searchParams.get("cookbook");
  expect(id).toBeTruthy();
  return id!;
}

test.describe("make it yours", () => {
  for (const viewport of [
    { width: 390, height: 844 },
    { width: 1440, height: 900 },
  ]) {
    test(`dedication, cover, and order apply to the reader at ${viewport.width}`, async ({
      page,
    }) => {
      test.setTimeout(120_000);
      await page.setViewportSize(viewport);
      const id = await weekendId(page);
      let original: string[] = [];
      try {
        await page.goto(`/cookbooks/${id}/book`);
        await page.getByRole("button", { name: "Make it yours" }).click();
        const sheet = page.getByRole("dialog", { name: "Make it yours" });
        await expect(sheet).toBeVisible();
        mkdirSync(shotRoot, { recursive: true });
        await page.screenshot({ path: path.join(shotRoot, `sheet-${viewport.width}.png`) });

        await sheet.getByLabel("Title", { exact: true }).fill("Weekend book");
        await sheet.getByLabel("Dedication").fill("For Mom, Christmas 2026");
        await sheet.getByRole("radio", { name: "Type only" }).click();
        original = await sheet
          .locator(".book-order li")
          .evaluateAll((items) => items.map((li) => li.getAttribute("data-recipe-id")!));
        const titles = sheet.locator(".book-order-title");
        const before = await titles.allTextContents();
        expect(before.length).toBeGreaterThan(1);
        await sheet.getByRole("button", { name: `Move ${before[1]} up` }).click();
        await expect(titles.first()).toHaveText(before[1]!);
        await sheet.getByRole("button", { name: "Save book" }).click();
        // The first PATCH compiles the route on the CI dev server, so allow for it.
        await expect(sheet).toBeHidden({ timeout: 60_000 });

        // Live: the cover takes the new title with no photo, the dedication is page 2.
        const cover = page.locator(".book-page--cover").first();
        await expect(cover.locator("h1")).toHaveText("Weekend book");
        await expect(cover.locator("img")).toHaveCount(0);
        await expect(page.locator(".book-dedication")).toHaveText("For Mom, Christmas 2026");
        await expect(
          page
            .locator(".book-page--contents .book-toc li:not(.book-toc-section) .book-toc-title")
            .first()
        ).toHaveText(before[1]!);
        await page.keyboard.press("ArrowRight");
        await page.waitForTimeout(800);
        await page.screenshot({ path: path.join(shotRoot, `applied-${viewport.width}.png`) });

        // The print route lays out the same pages.
        await page.goto(`/print/cookbooks/${id}?mode=home`);
        await expect(page.locator(".book-dedication")).toHaveText("For Mom, Christmas 2026");

        // Reopening shows what was saved.
        await page.goto(`/cookbooks/${id}/book`);
        await page.getByRole("button", { name: "Make it yours" }).click();
        await expect(page.getByLabel("Dedication")).toHaveValue("For Mom, Christmas 2026");
        await expect(page.getByRole("radio", { name: "Type only" })).toHaveAttribute(
          "aria-checked",
          "true"
        );
      } finally {
        const reset = await page.request.patch(`/api/v1/cookbooks/${id}`, {
          data: { bookSettings: null, ...(original.length ? { recipeOrder: original } : {}) },
        });
        expect(reset.status()).toBe(200);
      }
    });
  }

  test("REST refuses a cover that is not in the book", async ({ page }) => {
    const id = await weekendId(page);
    const response = await page.request.patch(`/api/v1/cookbooks/${id}`, {
      data: {
        bookSettings: {
          cover: { kind: "recipe", recipeId: "00000000-0000-4000-8000-000000000999" },
        },
      },
    });
    expect(response.status()).toBe(400);
    expect((await response.json()).detail).toMatch(/not in this cookbook/);
  });
});
