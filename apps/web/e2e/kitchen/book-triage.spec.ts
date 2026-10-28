import { expect, test, type Page } from "@playwright/test";
import path from "node:path";

const JOB = "00000000-0000-4000-8000-00000000b002";
const WIDTHS = [1440, 375, 320] as const;
const shotRoot = process.env.E2E_SHOT_DIR
  ? path.resolve(process.env.E2E_SHOT_DIR)
  : path.resolve(__dirname, "../../../../e2e-artifacts/kitchen/book-triage");

async function noOverflow(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth
  );
  expect(overflow).toBeLessThanOrEqual(0);
}

test.describe("book triage", () => {
  test("imports a whole book into a cookbook", async ({ page }) => {
    test.setTimeout(120_000);

    for (const width of WIDTHS) {
      await page.setViewportSize({ width, height: width === 1440 ? 900 : 844 });
      await page.goto(`/recipes/books/${JOB}`);
      await expect(page.getByRole("region", { name: "Needs a look" })).toBeVisible();
      await noOverflow(page);
      await page.screenshot({ path: path.join(shotRoot, `${width}-triage.png`), fullPage: true });
    }
    await page.setViewportSize({ width: 1440, height: 900 });

    await page.goto("/recipes");
    const tile = page.getByRole("link", { name: /A Synthetic Pantry/ });
    await expect(tile).toContainText("1 of 3 ready");
    await tile.click();

    await expect(page.getByText("1 of 3 ready. 2 need a look.")).toBeVisible();
    const ready = page.getByRole("region", { name: "Ready" });
    await expect(ready.getByText("Lemon Bars")).toBeVisible();
    await expect(ready.getByText("p. 1", { exact: true })).toBeVisible();
    const flagged = page.getByRole("region", { name: "Needs a look" });
    await expect(flagged.getByText("Check servings.")).toBeVisible();
    await expect(flagged.getByText(/could not find "Ginger Snaps"/)).toBeVisible();

    // Bulk accept the Ready one.
    await page.getByRole("button", { name: "Save 1 ready recipe" }).click();
    const saved = page.getByRole("region", { name: "Saved" });
    // First hit compiles the save route; slow CI runners need more than 5s.
    await expect(saved.getByRole("link", { name: "Lemon Bars" })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole("region", { name: "Ready" })).toHaveCount(0);

    // Fix a flagged recipe in the review form.
    await flagged
      .getByRole("listitem")
      .filter({ hasText: "Shortbread" })
      .getByRole("button")
      .click();
    const sheet = page.getByRole("dialog", { name: "Review recipe" });
    await expect(sheet.getByText("Check servings.")).toBeVisible();
    await sheet.getByLabel("Servings").fill("16");
    await sheet.getByRole("button", { name: "Save recipe" }).click();
    await expect(sheet).toHaveCount(0);
    await expect(saved.getByRole("link", { name: "Shortbread" })).toBeVisible();

    // A recipe the reader could not pull: type it in from the page.
    await flagged
      .getByRole("listitem")
      .filter({ hasText: "Ginger Snaps" })
      .getByRole("button")
      .click();
    await expect(sheet.getByLabel("Title")).toHaveValue("Ginger Snaps");
    await sheet.getByLabel("Ingredients").fill("2 cups flour\n1 tbsp ginger");
    await sheet.getByLabel("Steps").fill("Roll into balls and bake.");
    await sheet.getByRole("button", { name: "Save recipe" }).click();
    await expect(page.getByText("3 of 3 saved.")).toBeVisible();

    // The cookbook keeps the book's title; each recipe credits its page.
    await page.getByRole("link", { name: "Open the cookbook" }).click();
    await page.waitForURL(/\/recipes\?cookbook=/, { timeout: 30_000 });
    await expect(page.getByRole("heading", { name: "A Synthetic Pantry" })).toBeVisible();
    await page
      .getByRole("link", { name: /Shortbread/ })
      .first()
      .click();
    await page.waitForURL(/\/recipes\/[0-9a-f-]{36}/, { timeout: 30_000 });
    await expect(page.locator(".book-attribution")).toHaveText("From A Synthetic Pantry, p. 2");

    await page.goto("/recipes");
    await expect(page.getByRole("link", { name: /A Synthetic Pantry/ })).toContainText("3 recipes");
    await expect(page.getByText("1 of 3 ready")).toHaveCount(0);
  });
});
