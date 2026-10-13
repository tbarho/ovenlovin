import { expect, test } from "@playwright/test";

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
  await page.getByTestId("tile-milk").click();
  await expect(page.getByRole("tab", { name: "Can't have" })).toHaveAttribute(
    "aria-selected",
    "true"
  );
  await page
    .getByRole("dialog", { name: "Add a rule" })
    .getByRole("button", { name: "Done" })
    .click();
  await expect(page.getByRole("dialog", { name: "Add a rule" })).toHaveCount(0);
  await expect(page.getByTestId("bucket-cant_have")).toContainText(/milk/i);

  await page
    .getByTestId("bucket-cant_have")
    .getByRole("button", { name: "Tree nuts", exact: true })
    .click();
  await expect(page.getByLabel(/treat coconut as a tree nut/i)).toBeVisible();
  await page.getByRole("button", { name: "Close", exact: true }).click();

  await page.screenshot({
    path: `../../e2e-artifacts/prototype-jake-${testInfo.project.name}.png`,
    fullPage: true,
  });

  await page.getByRole("button", { name: "Reset demo" }).first().click();

  await page.getByRole("link", { name: "Recipes" }).first().click();
  await expect(page.getByRole("heading", { name: /pesto pasta/i })).toBeVisible();
  await expect(page.getByTestId("mark-jake")).toHaveAttribute("data-mark", "block");
  await expect(page.getByTestId("mark-ty")).toHaveAttribute("data-mark", "ok");

  await page.getByTestId("mark-jake").click();
  await expect(
    page.getByText(/contains pine nuts, which counts as a tree nut for Jake/i)
  ).toBeVisible();
  await page.getByRole("button", { name: "Close", exact: true }).click();

  await page.getByTestId("swap-sunflower").click();
  await expect(page.getByTestId("mark-jake")).toHaveAttribute("data-mark", "warn");

  await page.screenshot({
    path: `../../e2e-artifacts/prototype-recipe-${testInfo.project.name}.png`,
    fullPage: true,
  });
});
