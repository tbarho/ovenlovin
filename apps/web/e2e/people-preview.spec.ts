import { expect, test } from "@playwright/test";
import { gotoDevPreview } from "./dev-routes";

test("unsigned people preview shows the production people cards", async ({ page }, testInfo) => {
  test.skip(
    !(await gotoDevPreview(page, "/dev/people-preview")),
    "people-preview is gated on production"
  );
  await page.waitForLoadState("networkidle");

  await expect(page.getByRole("heading", { name: "Household 1" })).toBeVisible();
  await expect(page.getByText("Child B")).toBeVisible();
  await expect(page.getByTestId("severe-badge")).toHaveText(/1 severe allergy/i);
  await expect(
    page.getByTestId("person-card-cant_eat-00000000-0000-4000-8000-000000000012")
  ).toContainText(/peanut/i);
  await expect(
    page.getByTestId("person-card-loves-00000000-0000-4000-8000-000000000012")
  ).toContainText(/salmon/i);
  const emptyCantEat = page
    .getByTestId("person-card-cant_eat-00000000-0000-4000-8000-000000000017")
    .first();
  await expect(emptyCantEat).toHaveClass(/is-empty/);
  await expect(emptyCantEat).toHaveCSS("border-left-width", "0px");
  await expect(emptyCantEat).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
  const filledCantEat = page.getByTestId(
    "person-card-cant_eat-00000000-0000-4000-8000-000000000010"
  );
  await expect(filledCantEat).not.toHaveClass(/is-empty/);
  const cards = page.locator(".olp-person-card");
  const cardCount = await cards.count();
  expect(cardCount).toBeGreaterThan(0);
  for (let index = 0; index < cardCount; index += 1) {
    const card = cards.nth(index);
    const handle = card.getByRole("button", { name: /^Reorder / });
    await expect(handle).toHaveCount(1);
    await expect(card).toHaveCSS("position", "relative");
    await expect(handle).toHaveCSS("position", "absolute");
    const pad = await card.evaluate((el) => getComputedStyle(el).paddingTop);
    expect(pad).toBe("8px");
    await expect(handle).toHaveCSS("top", pad);
    await expect(handle).toHaveCSS("right", pad);
    const handleBox = await handle.boundingBox();
    const nameBox = await card.locator(".olp-person-identity").boundingBox();
    expect(handleBox && nameBox).toBeTruthy();
    if (!handleBox || !nameBox) continue;
    expect(handleBox.width).toBeGreaterThanOrEqual(44);
    expect(handleBox.height).toBeGreaterThanOrEqual(44);
    expect(nameBox.x + nameBox.width).toBeLessThanOrEqual(handleBox.x + 1);
  }
  await page.screenshot({
    path: `../../e2e-artifacts/people-preview-list-${testInfo.project.name}.png`,
    fullPage: true,
  });

  await page.goto("/dev/people-preview?view=person");
  await page.waitForLoadState("networkidle");
  await expect(page.getByRole("heading", { name: "Child B" })).toBeVisible();
  await expect(page.getByTestId("bucket-cant_eat")).toContainText(/peanut/i);
  await expect(page.getByTestId("bucket-cant_eat")).toContainText(/tree nut/i);
  await expect(page.getByTestId("bucket-loves")).toBeVisible();

  await expect(page.getByTestId("bucket-cant_eat").getByPlaceholder("Add…")).toBeVisible();
  await page.getByTestId("bucket-cant_eat").getByPlaceholder("Add…").click();
  await expect(page.getByTestId("tile-tree_nut")).toBeVisible();
  await page.getByRole("button", { name: /edit child b/i }).click();
  const dialog = page.getByRole("dialog", { name: /edit person/i });
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
