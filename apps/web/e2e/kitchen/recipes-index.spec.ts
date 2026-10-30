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
  await expect(page.getByRole("button", { name: "+ Import" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Import a recipe" })).toHaveCount(0);
  await expect(page.getByLabel("Search recipes")).toBeVisible();
  await expect(page.getByRole("tab", { name: "All recipes" })).toBeVisible();
  await expectFirstRecipeInViewport(page);

  await page.getByRole("button", { name: "+ Import" }).click();
  await expect(page.getByRole("heading", { name: "Import a recipe" })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Link" })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Photo" })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Cookbook" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Save from your browser" })).toHaveCount(0);
  await expect(page.getByText("Save from Safari on iPhone")).toBeVisible();
  await expect(page.getByText("Bookmarklet for desktop browsers")).toBeVisible();
});

test("paste import previews then saves from review", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/recipes");
  await page.getByRole("button", { name: "+ Import" }).click();
  await page.getByRole("button", { name: "Paste the recipe text" }).click();
  await page
    .getByPlaceholder(/weeknight tomato pasta/i)
    .fill(
      "Weeknight tomato pasta\n\nIngredients\n- 12 oz pasta\n- 1 jar tomatoes\n\nSteps\nBoil pasta. Warm sauce. Combine."
    );
  const sheet = page.getByRole("dialog", { name: "Import a recipe" });
  await sheet.getByRole("button", { name: "Import", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Review before saving" });
  await expect(dialog.getByLabel("Title")).toBeVisible({ timeout: 30_000 });
  await expect(dialog.getByLabel("Title")).toHaveValue(/pasta/i);
  await dialog.getByRole("button", { name: "Save to kitchen" }).click();
  await expect(page).toHaveURL(/\/recipes\/[0-9a-f-]{36}/i, { timeout: 15_000 });
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
});

test("recipe list is in the first desktop viewport", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/recipes");
  await expect(page.getByRole("heading", { name: "Recipes" })).toBeVisible();
  await expect(page.getByRole("button", { name: "+ Import" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Import a recipe" })).toHaveCount(0);
  await expect(page.getByLabel("Search recipes")).toBeVisible();
  await expectFirstRecipeInViewport(page);
});

/** The focus ring (outline + offset) and border must sit inside the sheet's scroll box. */
async function expectFocusRingInsideSheet(page: Page, selector: string) {
  const field = page.locator(selector);
  await field.focus();
  await expect(field).toBeFocused();
  const measured = await field.evaluate((el) => {
    const style = getComputedStyle(el);
    const ring = parseFloat(style.outlineWidth) + parseFloat(style.outlineOffset);
    const box = el.getBoundingClientRect();
    const body = el.closest(".sheet-body");
    if (!body) return null;
    const clip = body.getBoundingClientRect();
    return {
      ring,
      outlineStyle: style.outlineStyle,
      border: style.borderLeftColor,
      left: box.left - ring,
      right: box.right + ring,
      clipLeft: clip.left,
      clipRight: clip.right,
    };
  });
  expect(measured).toBeTruthy();
  if (!measured) return;
  expect(measured.outlineStyle).toBe("solid");
  expect(measured.ring).toBeGreaterThan(0);
  expect(measured.border).not.toBe("rgb(234, 234, 234)");
  expect(measured.left).toBeGreaterThanOrEqual(measured.clipLeft);
  expect(measured.right).toBeLessThanOrEqual(measured.clipRight);
}

test("Instagram link goes to caption paste and focus rings are not clipped at 390", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/recipes");
  await page.getByRole("button", { name: "+ Import" }).click();
  const sheet = page.getByRole("dialog", { name: "Import a recipe" });
  const link = sheet.getByPlaceholder("https://www.instagram.com/reel/...");
  await expect(link).toBeVisible();
  // Text fields match :focus-visible on any focus, so this is the ring a phone tap shows.
  await expectFocusRingInsideSheet(page, '[role=dialog] input[inputmode="url"]');

  await link.fill("https://www.instagram.com/reel/C9mIsoButter/");
  await expect(sheet.getByText(/We can't read Instagram links yet/)).toBeVisible();
  await expect(sheet.getByText(/We read the caption/)).toHaveCount(0);
  await sheet.getByRole("button", { name: "Paste the caption" }).click();
  await expect(sheet.getByRole("heading", { name: "Paste the caption" })).toBeVisible();
  await expect(sheet.getByTestId("import-progress")).toHaveCount(0);
  await expect(sheet.getByRole("button", { name: /Try again/ })).toHaveCount(0);
  await expectFocusRingInsideSheet(page, "[role=dialog] textarea.import-caption-box");
});
