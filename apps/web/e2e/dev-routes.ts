import { expect, type Page } from "@playwright/test";

/** Production 404s /prototype and /dev. Skip those specs on the live host. */
export async function gotoDevPreview(page: Page, path: string): Promise<boolean> {
  const response = await page.goto(path);
  if (response?.status() === 404) return false;
  await expect(page.locator("body")).not.toHaveText(/^Not Found$/);
  return true;
}
