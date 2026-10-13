import { expect, test } from "@playwright/test";

test("unsigned people preview shows the production people cards", async ({ page }, testInfo) => {
  await page.goto("/dev/people-preview");
  await page.waitForLoadState("networkidle");

  await expect(page.getByRole("heading", { name: "Household 1" })).toBeVisible();
  await expect(page.getByText("Child B")).toBeVisible();
  await expect(page.getByTestId("severe-badge")).toHaveText(/1 severe allergy/i);
  await page.screenshot({
    path: `../../e2e-artifacts/people-preview-list-${testInfo.project.name}.png`,
    fullPage: true,
  });

  await page.goto("/dev/people-preview?view=person");
  await page.waitForLoadState("networkidle");
  await expect(page.getByRole("heading", { name: "Child B" })).toBeVisible();
  await expect(page.getByTestId("bucket-cant_have")).toContainText(/peanut/i);
  await expect(page.getByTestId("bucket-cant_have")).toContainText(/tree nut/i);

  await page.getByRole("button", { name: "Add", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Add a rule" });
  await expect(dialog).toBeVisible();
  await expect(dialog).toHaveCSS("opacity", "1");
  const background = await dialog.evaluate((el) => getComputedStyle(el).backgroundColor);
  expect(background.replace(/\s/g, "")).toMatch(/^rgba?\(255,255,255(?:,1)?\)$/);
  await expect(page.locator(".olp-sheet-root")).toHaveCount(1);
  const sheetParent = await page
    .locator(".olp-sheet-root")
    .evaluate((el) => el.parentElement?.tagName);
  expect(sheetParent).toBe("BODY");
  await page.evaluate(() => window.scrollTo(0, 0));
  const headerBox = await page.locator(".kitchen-topbar").boundingBox();
  expect(headerBox).toBeTruthy();
  expect(headerBox!.y).toBeGreaterThanOrEqual(-1);
  const cover = await page.evaluate(() => {
    const el = document.elementFromPoint(24, 16);
    return el?.className ?? "";
  });
  expect(cover).toMatch(/sheet-backdrop|olp-sheet/);
  await page.screenshot({
    path: `../../e2e-artifacts/people-preview-add-${testInfo.project.name}.png`,
    fullPage: true,
  });
  await page.screenshot({
    path: `../../e2e-artifacts/people-preview-add-viewport-${testInfo.project.name}.png`,
  });

  await page.goto("/dev/people-preview?view=recipe");
  await page.waitForLoadState("networkidle");
  await expect(page.getByTestId("who-can-eat")).toBeVisible();
  await page.locator("[data-testid^='mark-'][data-mark='block']").click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.evaluate(() => window.scrollTo(0, 0));
  const recipeHeader = await page.locator(".kitchen-topbar").boundingBox();
  expect(recipeHeader).toBeTruthy();
  expect(recipeHeader!.y).toBeGreaterThanOrEqual(-1);
  const recipeCover = await page.evaluate(() => {
    const el = document.elementFromPoint(24, 16);
    return el?.className ?? "";
  });
  expect(recipeCover).toMatch(/sheet-backdrop|olp-sheet/);
  await page.screenshot({
    path: `../../e2e-artifacts/people-preview-recipe-${testInfo.project.name}.png`,
    fullPage: true,
  });
  await page.screenshot({
    path: `../../e2e-artifacts/people-preview-recipe-viewport-${testInfo.project.name}.png`,
  });
});
