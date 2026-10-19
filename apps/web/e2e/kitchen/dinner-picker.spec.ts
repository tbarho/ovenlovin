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
});
