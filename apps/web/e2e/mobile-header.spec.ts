import { expect, test } from "@playwright/test";

const widths = [360, 390, 430] as const;

test.describe("mobile kitchen chrome", () => {
  test.skip(({ isMobile }) => !isMobile, "header layout check is mobile-viewport only");

  for (const width of widths) {
    test(`stays compact at ${width}px`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width, height: 780 });
      await page.goto("/recipes");
      await page.waitForLoadState("networkidle");

      const tabbar = page.locator(".kitchen-tabbar");
      const topbar = page.locator(".kitchen-topbar");
      const inKitchen = await tabbar.count();

      if (inKitchen > 0) {
        await expect(tabbar).toBeVisible();
        await expect(page.locator(".kitchen-shell .kitchen-nav")).toBeHidden();
        await expect(topbar.locator(".brand-wordmark-short")).toBeVisible();
        await expect(page.getByRole("navigation", { name: "Kitchen" })).toBeVisible();
      } else {
        await expect(page.getByRole("heading", { name: /sign in|recipes/i }).first()).toBeVisible();
      }

      await page.screenshot({
        path: `../../e2e-artifacts/header-${width}-${testInfo.project.name}.png`,
        fullPage: true,
      });
    });
  }
});
