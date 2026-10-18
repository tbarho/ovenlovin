import { expect, test } from "@playwright/test";

test.describe("phone kitchen menu", () => {
  test("replaces the tab bar with a sheet of destinations at 390px", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/recipes");
    await expect(page.getByRole("heading", { name: "Recipes" })).toBeVisible();
    await expect(page.locator(".kitchen-tabbar")).toHaveCount(0);

    const trigger = page.getByRole("button", { name: "Open kitchen menu" });
    await expect(trigger).toBeVisible();
    const triggerBox = await trigger.boundingBox();
    expect(triggerBox).toBeTruthy();
    expect(triggerBox!.width).toBeGreaterThanOrEqual(44);
    expect(triggerBox!.height).toBeGreaterThanOrEqual(44);

    await trigger.click();
    const dialog = page.getByRole("dialog", { name: "Menu" });
    await expect(dialog).toBeVisible();
    await expect(dialog).toHaveAttribute("aria-modal", "true");
    await expect(dialog.getByRole("link", { name: "Recipes" })).toHaveAttribute(
      "aria-current",
      "page"
    );
    await expect(dialog.getByRole("link", { name: "Plan" })).toBeVisible();
    await expect(dialog.getByRole("link", { name: "List" })).toBeVisible();
    await expect(dialog.getByRole("link", { name: "People" })).toBeVisible();
    await expect(dialog.getByRole("link", { name: "Settings" })).toBeVisible();
    const peopleBox = await dialog.getByRole("link", { name: "People" }).boundingBox();
    expect(peopleBox).toBeTruthy();
    expect(peopleBox!.height).toBeGreaterThanOrEqual(44);

    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(trigger).toBeFocused();

    await trigger.click();
    await page.locator(".sheet-backdrop").click({ position: { x: 20, y: 20 }, force: true });
    await expect(dialog).toHaveCount(0);

    await trigger.click();
    await dialog.getByRole("link", { name: "People" }).click();
    await expect(page).toHaveURL(/\/people/);
    await expect(page.getByRole("dialog", { name: "Menu" })).toHaveCount(0);

    await trigger.click();
    const panel = page.locator(".kitchen-menu-sheet .sheet-panel");
    const box = await panel.boundingBox();
    expect(box).toBeTruthy();
    await page.mouse.move(box!.x + box!.width / 2, box!.y + 18);
    await page.mouse.down();
    await page.mouse.move(box!.x + box!.width / 2, box!.y + 220, { steps: 12 });
    await page.mouse.up();
    await expect(page.getByRole("dialog", { name: "Menu" })).toHaveCount(0);
  });

  test("keeps desktop sidebar navigation at 1440px", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/recipes");
    await expect(page.getByRole("heading", { name: "Recipes" })).toBeVisible();
    await expect(page.locator(".kitchen-menu-trigger")).toBeHidden();
    await expect(page.getByRole("navigation", { name: "Kitchen" })).toBeVisible();
    await expect(
      page.getByRole("navigation", { name: "Kitchen" }).getByRole("link", { name: "People" })
    ).toBeVisible();
  });
});
