import { expect, test, type Page } from "@playwright/test";
import path from "node:path";

const WIDTHS = [1440, 390] as const;
const shotRoot = process.env.E2E_SHOT_DIR
  ? path.resolve(process.env.E2E_SHOT_DIR)
  : path.resolve(__dirname, "../../../../e2e-artifacts/kitchen/add-recipes");

async function shot(page: Page, width: number, name: string, fullPage = true) {
  await page.waitForLoadState("domcontentloaded");
  await page.screenshot({
    path: path.join(shotRoot, `${width}-${name}.png`),
    fullPage,
    animations: "disabled",
  });
}

test.describe("cookbook add recipes picker", () => {
  test("captures desktop and mobile picker screens", async ({ page }) => {
    test.setTimeout(90_000);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/recipes");
    await expect(page.getByRole("link", { name: /weeknight dinners/i })).toBeVisible();
    const cookbookHref = await page
      .getByRole("link", { name: /weeknight dinners/i })
      .first()
      .getAttribute("href");
    const emptyHref = await page
      .getByRole("link", { name: /scratch book/i })
      .first()
      .getAttribute("href");
    expect(cookbookHref).toBeTruthy();
    expect(emptyHref).toBeTruthy();

    for (const width of WIDTHS) {
      await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });

      await page.goto(cookbookHref!);
      await expect(page.getByRole("heading", { name: /weeknight dinners/i })).toBeVisible();
      await expect(page.getByRole("button", { name: "Remove" }).first()).toBeVisible();
      await shot(page, width, "cookbook-detail-v2");

      await page.getByRole("button", { name: "Add recipes" }).click();
      const dialog = page.getByRole("dialog", { name: "Add recipes" });
      await expect(dialog).toBeVisible();
      await expect(dialog.getByText("Already in this book").first()).toBeVisible();
      await shot(page, width, "cookbook-add-recipes-v2", false);
      await page.keyboard.press("Escape");
      await expect(dialog).toHaveCount(0);

      await page.goto(emptyHref!);
      await expect(page.getByText("This cookbook is empty.")).toBeVisible();
      await expect(page.getByRole("button", { name: "Add recipes" })).toHaveCount(2);
      await shot(page, width, "cookbook-empty-v2");
    }
  });
});
