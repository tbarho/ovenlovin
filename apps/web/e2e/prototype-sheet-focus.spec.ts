import { expect, test } from "@playwright/test";

test("prototype sheet inputs keep focus for a full word", async ({ page }) => {
  await page.goto("/prototype/people");
  await page.waitForLoadState("networkidle");
  await page.getByTestId("person-chip-jake").click();
  await expect(page.getByRole("heading", { name: "Jake" })).toBeVisible();

  await page.getByRole("button", { name: "Add something" }).click();
  const search = page.getByPlaceholder(/search garlic, coconut, pork/i);
  await expect(search).toBeVisible();
  await search.click();
  await search.pressSequentially("garlic", { delay: 40 });
  await expect(search).toHaveValue("garlic");
  await expect(search).toBeFocused();
});
