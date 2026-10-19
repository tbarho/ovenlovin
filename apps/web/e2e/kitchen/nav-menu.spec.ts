import { expect, test, type Page } from "@playwright/test";

async function openMenu(page: Page) {
  const trigger = page.getByRole("button", { name: "Open kitchen menu" });
  await trigger.click();
  const dialog = page.getByRole("dialog", { name: "Menu" });
  await expect(dialog).toBeVisible();
  return { trigger, dialog };
}

test.describe("phone kitchen menu", () => {
  test("replaces the tab bar with a compact header at 390px", async ({ page }) => {
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
  });

  test("lists destinations, marks the current page, and closes without trapping the route", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/recipes");
    await expect(page.getByRole("heading", { name: "Recipes" })).toBeVisible();

    const { trigger, dialog } = await openMenu(page);
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

    await Promise.all([
      page.waitForURL("**/people"),
      dialog.getByRole("link", { name: "People" }).click(),
    ]);
    await expect(page.getByRole("button", { name: "Add person" })).toBeVisible();
    await expect(page.getByRole("dialog", { name: "Menu" })).toHaveCount(0);
    await expect(trigger).toBeVisible();
  });

  test("closes on overlay, Escape, swipe, and returns focus to the button", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/recipes");
    await expect(page.getByRole("heading", { name: "Recipes" })).toBeVisible();

    const { trigger, dialog } = await openMenu(page);
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(trigger).toBeFocused();

    await openMenu(page);
    await page.locator(".sheet-backdrop").click({ position: { x: 20, y: 20 }, force: true });
    await expect(dialog).toHaveCount(0);

    await openMenu(page);
    const handle = page.locator(".kitchen-menu-sheet .sheet-handle");
    const box = await handle.boundingBox();
    expect(box).toBeTruthy();
    await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
    await page.mouse.down();
    await page.mouse.move(box!.x + box!.width / 2, box!.y + 220, { steps: 12 });
    await page.mouse.up();
    await expect(page.getByRole("dialog", { name: "Menu" })).toHaveCount(0);
  });

  test("redirects /plan to /plans", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/plan");
    await expect(page).toHaveURL(/\/plans\/?$/);
    await expect(page.getByRole("heading", { name: "This week" })).toBeVisible();
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
