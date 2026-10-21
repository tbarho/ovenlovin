import { expect, test } from "@playwright/test";

test.describe("dinner picker safety grouping", () => {
  test("keeps ask-first recipes visible and collapses only hard blocks at 390px", async ({
    page,
  }) => {
    test.setTimeout(60_000);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/plans");
    await expect(page.getByRole("heading", { name: "This week" })).toBeVisible();
    await page.getByRole("button", { name: /edit monday dinner/i }).click();
    const editor = page.getByTestId(/plan-editor-/);
    await expect(editor).toBeVisible();

    await expect(editor.getByRole("button", { name: /veggie tacos/i })).toBeVisible();
    await expect(editor.getByRole("button", { name: /kung pao chicken/i })).toHaveCount(0);

    const blocked = editor.getByRole("button", { name: /not safe for everyone/i });
    await expect(blocked).toBeVisible();
    await blocked.click();
    await expect(editor.getByRole("button", { name: /kung pao chicken/i })).toBeVisible();
    await expect(editor.getByText(/can't eat this/i).first()).toBeVisible();
  });

  test("keeps a failed mid-list add in the viewport at 390px", async ({ page }) => {
    test.setTimeout(60_000);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.route("**/api/v1/meal-plans**", async (route) => {
      if (route.request().method() === "GET") return route.continue();
      await route.fulfill({
        status: 500,
        contentType: "application/problem+json",
        body: JSON.stringify({ title: "Internal Server Error", status: 500 }),
      });
    });
    await page.goto("/plans");
    await expect(page.getByRole("heading", { name: "This week" })).toBeVisible();
    await page.getByRole("button", { name: /edit tuesday dinner/i }).click();
    const editor = page.getByTestId(/plan-editor-/);
    await expect(editor).toBeVisible();
    const picks = editor.locator(".week-pick");
    await expect(picks.first()).toBeVisible();
    const count = await picks.count();
    expect(count).toBeGreaterThan(2);
    const mid = picks.nth(Math.min(2, count - 1));
    await mid.scrollIntoViewIfNeeded();
    const title = ((await mid.locator("strong").textContent()) ?? "").trim();
    expect(title.length).toBeGreaterThan(0);
    await mid.click();
    const alert = page.getByRole("alert").filter({ hasText: "Nothing was saved" });
    await expect(alert).toBeVisible();
    await expect(alert).toBeInViewport();
    await expect(alert).toContainText(new RegExp(`Couldn't (add|swap) ${title} to Tuesday`));
    await expect(alert.getByRole("button", { name: "Try again" })).toBeVisible();
    await page.screenshot({
      path: "/opt/cursor/artifacts/screenshots/390-plan-failed-add-after.png",
      animations: "disabled",
    });
  });
});
