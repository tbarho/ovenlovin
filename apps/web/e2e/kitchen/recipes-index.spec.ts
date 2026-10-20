import { expect, test, type Page } from "@playwright/test";

async function expectFirstRecipeInViewport(page: Page) {
  const viewport = page.viewportSize();
  expect(viewport).toBeTruthy();
  const card = page.locator("a.recipe-card").first();
  await expect(card).toBeVisible();
  const box = await card.boundingBox();
  expect(box).toBeTruthy();
  if (!box || !viewport) return;
  expect(box.y).toBeGreaterThanOrEqual(0);
  expect(box.y).toBeLessThan(viewport.height);
}

test("recipe list is in the first phone viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/recipes");
  await expect(page.getByRole("heading", { name: "Recipes" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Add recipe" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Import a recipe" })).toHaveCount(0);
  await expect(page.getByLabel("Search recipes")).toBeVisible();
  await expect(page.getByRole("tab", { name: "All recipes" })).toBeVisible();
  await expectFirstRecipeInViewport(page);

  await page.getByRole("button", { name: "Add recipe" }).click();
  await expect(page.getByRole("heading", { name: "Import a recipe" })).toBeVisible();
  await expect(page.getByRole("tab", { name: "URL" })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Paste" })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Photo" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Save from your browser" })).toHaveCount(0);
  await expect(page.getByText("Save from Safari on iPhone")).toBeVisible();
  await expect(page.getByText("Advanced")).toBeVisible();
});

test("paste import previews then saves from review", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/recipes");
  await page.getByRole("button", { name: "Add recipe" }).click();
  await page.getByRole("tab", { name: "Paste" }).click();
  await page
    .getByPlaceholder(/weeknight tomato pasta/i)
    .fill(
      "Weeknight tomato pasta\n\nIngredients\n- 12 oz pasta\n- 1 jar tomatoes\n\nSteps\nBoil pasta. Warm sauce. Combine."
    );
  await page.getByRole("button", { name: "Import" }).click();
  const dialog = page.getByRole("dialog", { name: "Review import" });
  await expect(dialog.getByLabel("Title")).toBeVisible({ timeout: 30_000 });
  await expect(dialog.getByLabel("Title")).toHaveValue(/pasta/i);
  await dialog.getByRole("button", { name: "Save recipe" }).click();
  await expect(page).toHaveURL(/\/recipes\/[0-9a-f-]{36}/i, { timeout: 15_000 });
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
});

test("recipe list is in the first desktop viewport", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/recipes");
  await expect(page.getByRole("heading", { name: "Recipes" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Add recipe" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Import a recipe" })).toHaveCount(0);
  await expect(page.getByLabel("Search recipes")).toBeVisible();
  await expectFirstRecipeInViewport(page);
});
