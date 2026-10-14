import { expect, test } from "@playwright/test";
import { gotoDevPreview } from "./dev-routes";

test("prototype sheet inputs keep focus for a full word", async ({ page }) => {
  test.skip(!(await gotoDevPreview(page, "/prototype/people")), "prototype is gated on production");
  await page.waitForLoadState("networkidle");
  await page.getByTestId("person-chip-jake").click();
  await expect(page.getByRole("heading", { name: "Jake" })).toBeVisible();

  await page.getByRole("button", { name: "Add", exact: true }).click();
  const search = page.getByLabel(/search foods/i);
  await expect(search).toBeVisible();
  await search.click();
  await search.pressSequentially("garlic", { delay: 40 });
  await expect(search).toHaveValue("garlic");
  await expect(search).toBeFocused();
});
