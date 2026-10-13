import { expect, test } from "@playwright/test";

test("recipes kitchen is photo-first after sign-in, or shows Clerk", async ({ page }, testInfo) => {
  await page.goto("/recipes");
  await page.waitForLoadState("networkidle");

  const heading = page.getByRole("heading", { name: /recipes|sign in/i }).first();
  await expect(heading).toBeVisible();

  const shot = `recipes-${testInfo.project.name}.png`;
  await page.screenshot({ path: `../../e2e-artifacts/${shot}`, fullPage: true });

  if (await page.getByRole("heading", { name: "Recipes" }).isVisible()) {
    await expect(page.getByText("KITCHEN")).toHaveCount(0);
    await expect(page.getByRole("button", { name: /new cookbook/i })).toBeVisible();
  }
});
