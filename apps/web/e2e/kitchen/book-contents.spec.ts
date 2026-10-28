import { expect, test } from "@playwright/test";
import path from "node:path";

const JOB = "00000000-0000-4000-8000-00000000b001";
const WIDTHS = [1440, 375, 320] as const;
const shotRoot = process.env.E2E_SHOT_DIR
  ? path.resolve(process.env.E2E_SHOT_DIR)
  : path.resolve(__dirname, "../../../../e2e-artifacts/kitchen/book-contents");

test.describe("book contents map", () => {
  test("shows the map and keeps picks across a reload", async ({ page }) => {
    test.setTimeout(90_000);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`/recipes/books/${JOB}`);

    await expect(page.getByRole("heading", { name: "A Synthetic Kitchen" })).toBeVisible();
    await page.getByRole("button", { name: "Select all" }).click();
    await expect(page.getByText("Saved")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText("3 of 3 recipes picked.")).toBeVisible();

    const baking = page.getByRole("region", { name: "Baking" });
    await expect(baking.getByText("Lemon Bars")).toBeVisible();
    await expect(baking.getByText("p. 1", { exact: true })).toBeVisible();
    await expect(page.getByRole("checkbox", { name: /Shortbread/ })).toBeChecked();

    await page.getByRole("checkbox", { name: /Shortbread/ }).uncheck();
    await expect(page.getByText("Saved")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText("2 of 3 recipes picked.")).toBeVisible();

    await page.getByLabel("Search the contents").fill("ginger");
    await expect(page.getByRole("checkbox")).toHaveCount(1);
    await page.getByLabel("Search the contents").fill("");

    await page.reload();
    await expect(page.getByRole("checkbox", { name: /Shortbread/ })).not.toBeChecked();
    await expect(page.getByRole("checkbox", { name: /Lemon Bars/ })).toBeChecked();

    await page.getByRole("button", { name: "Select none" }).click();
    await expect(page.getByText("0 of 3 recipes picked.")).toBeVisible();
    await expect(page.getByText("Saved")).toBeVisible({ timeout: 30_000 });
    await page.reload();
    await expect(page.getByText("0 of 3 recipes picked.")).toBeVisible();

    await page.getByRole("button", { name: "Select all" }).click();
    await expect(page.getByText("Saved")).toBeVisible({ timeout: 30_000 });

    for (const width of WIDTHS) {
      await page.setViewportSize({ width, height: width === 1440 ? 900 : 844 });
      await page.goto(`/recipes/books/${JOB}`);
      await expect(page.getByRole("checkbox", { name: /Lemon Bars/ })).toBeVisible();
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth
      );
      expect(overflow).toBeLessThanOrEqual(0);
      await page.screenshot({ path: path.join(shotRoot, `${width}-contents.png`), fullPage: true });
    }
  });
});
