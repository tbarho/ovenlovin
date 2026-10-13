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

  await page.getByRole("button", { name: "Add something" }).click();
  await expect(page.getByTestId("suggest-coconut")).toContainText(/coconut/i);
  await page.getByPlaceholder(/no dairy/i).fill("no dairy, hates mushrooms");
  await expect(page.getByTestId("parsed-chips")).toContainText(/milk/i);
  await expect(page.getByTestId("parsed-chips")).toContainText(/mushrooms/i);
  await page.getByRole("button", { name: "Close", exact: true }).click();

  await page.screenshot({
    path: `../../e2e-artifacts/prototype-jake-${testInfo.project.name}.png`,
    fullPage: true,
  });

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

  await page.getByRole("link", { name: "Setup" }).first().click();
  await expect(page.getByRole("heading", { name: /who do you cook for/i })).toBeVisible();
  await page.getByRole("button", { name: /start a new household/i }).click();
  await expect(page.getByRole("heading", { name: /name and a face/i })).toBeVisible();

  await page.screenshot({
    path: `../../e2e-artifacts/prototype-setup-${testInfo.project.name}.png`,
    fullPage: true,
  });
});
