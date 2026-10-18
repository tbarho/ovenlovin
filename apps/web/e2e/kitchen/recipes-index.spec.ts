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
  await expect(page.getByRole("heading", { name: "Save from your browser" })).toBeVisible();
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
