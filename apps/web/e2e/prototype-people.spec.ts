import { expect, type Page, test } from "@playwright/test";

async function expectSolidSheet(page: Page, title: string | RegExp) {
  const dialog = page.getByRole("dialog", { name: title });
  await expect(dialog).toBeVisible();
  await expect(dialog).toHaveCSS("opacity", "1");
  const background = await dialog.evaluate((el) => getComputedStyle(el).backgroundColor);
  expect(background.replace(/\s/g, "")).toMatch(/^rgba?\(255,255,255(?:,1)?\)$/);
  const zIndex = await dialog.evaluate((el) => getComputedStyle(el).zIndex);
  expect(Number(zIndex)).toBeGreaterThan(0);
  return dialog;
}

test("people rules prototype is public and clickable", async ({ page }, testInfo) => {
  await page.goto("/prototype/people");
  await page.waitForLoadState("networkidle");

  await expect(page.getByRole("heading", { name: "Your kitchen" })).toBeVisible();
  await expect(page.getByTestId("household-summary")).toContainText(/avoids peanuts/i);
  await expect(page.getByTestId("severe-badge")).toHaveText(/1 severe allergy/i);
  await expect(page.getByTestId("person-chip-jake")).toBeVisible();

  await page.screenshot({
    path: `../../e2e-artifacts/prototype-household-${testInfo.project.name}.png`,
    fullPage: true,
  });

  await page.getByTestId("person-chip-jake").click();
  await expect(page.getByRole("heading", { name: "Jake" })).toBeVisible();
  await expect(page.getByTestId("bucket-cant_have")).toContainText(/peanuts/i);
  await expect(page.getByTestId("bucket-cant_have")).toContainText(/tree nuts/i);

  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expectSolidSheet(page, "Add a rule");
  await page.screenshot({
    path: `../../e2e-artifacts/prototype-add-sheet-${testInfo.project.name}.png`,
    fullPage: true,
  });
  await page.getByTestId("tile-milk").click();
  const addSheet = await expectSolidSheet(page, "Add a rule");
  await expect(addSheet.getByRole("tab", { name: "Can't have" })).toHaveAttribute(
    "aria-selected",
    "true"
  );
  await addSheet.getByRole("button", { name: "Done" }).click();
  await expect(page.getByRole("dialog", { name: "Add a rule" })).toHaveCount(0);
  await expect(page.getByTestId("bucket-cant_have")).toContainText(/milk/i);

  await page
    .getByTestId("bucket-cant_have")
    .getByRole("button", { name: "Tree nuts", exact: true })
    .click();
  const editSheet = await expectSolidSheet(page, "Tree nuts");
  await expect(page.getByLabel(/treat coconut as a tree nut/i)).toBeVisible();
  await expect(editSheet.getByRole("button", { name: "Done" })).toBeVisible();
  await page.screenshot({
    path: `../../e2e-artifacts/prototype-jake-${testInfo.project.name}.png`,
    fullPage: true,
  });
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Tree nuts" })).toHaveCount(0);

  await page.getByRole("button", { name: "Delete Jake" }).click();
  await expectSolidSheet(page, "Remove Jake?");
  await page.screenshot({
    path: `../../e2e-artifacts/prototype-delete-sheet-${testInfo.project.name}.png`,
    fullPage: true,
  });
  await page.getByRole("button", { name: "Cancel" }).click();
  await expect(page.getByRole("dialog", { name: "Remove Jake?" })).toHaveCount(0);

  await page.getByRole("button", { name: "Reset demo" }).first().click();

  await page.getByRole("link", { name: "Recipes" }).first().click();
  await expect(page.getByRole("heading", { name: /pesto pasta/i })).toBeVisible();
  await expect(page.getByTestId("mark-jake")).toHaveAttribute("data-mark", "block");
  await expect(page.getByTestId("mark-ty")).toHaveAttribute("data-mark", "ok");

  await page.getByTestId("mark-jake").click();
  await expectSolidSheet(page, /can't eat this/i);
  await expect(
    page.getByText(/contains pine nuts, which counts as a tree nut for Jake/i)
  ).toBeVisible();
  await page.screenshot({
    path: `../../e2e-artifacts/prototype-reason-sheet-${testInfo.project.name}.png`,
    fullPage: true,
  });
  await page.getByRole("button", { name: "Close", exact: true }).click();

  await page.getByRole("tab", { name: "Custom" }).click();
  await expectSolidSheet(page, "Cooking for");
  await page.screenshot({
    path: `../../e2e-artifacts/prototype-custom-sheet-${testInfo.project.name}.png`,
    fullPage: true,
  });
  await page.getByRole("button", { name: "Close", exact: true }).click();

  await page.getByTestId("swap-sunflower").click();
  await expect(page.getByTestId("mark-jake")).toHaveAttribute("data-mark", "warn");

  await page.screenshot({
    path: `../../e2e-artifacts/prototype-recipe-${testInfo.project.name}.png`,
    fullPage: true,
  });
});
