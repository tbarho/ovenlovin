import { expect, test, type Page } from "@playwright/test";
import path from "node:path";

const TRIAGE_JOB = "00000000-0000-4000-8000-00000000b002";
const shotRoot = process.env.E2E_SHOT_DIR
  ? path.resolve(process.env.E2E_SHOT_DIR)
  : path.resolve(__dirname, "../../../../e2e-artifacts/kitchen/cookbook-share");

async function noOverflow(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth
  );
  expect(overflow).toBeLessThanOrEqual(0);
}

test.describe("cookbook share link", () => {
  test("a signed-out reader opens the link at 375, and a revoked link 404s", async ({
    page,
    browser,
  }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/recipes");
    const href = await page
      .getByRole("link", { name: /weeknight dinners/i })
      .first()
      .getAttribute("href");
    await page.goto(href!);

    await page.getByRole("button", { name: "Share", exact: true }).click();
    const sheet = page.getByRole("dialog", { name: "Share book" });
    const create = sheet.getByRole("button", { name: "Create link" });
    if (await create.isVisible()) await create.click();
    const input = sheet.getByLabel("Share link");
    await expect(input).toHaveValue(/\/read\/olbook_/, { timeout: 30_000 });
    await noOverflow(page);
    await page.screenshot({ path: path.join(shotRoot, "375-share-sheet.png") });
    const link = new URL(await input.inputValue());

    // A fresh context: no cookies, no kitchen session, phone width.
    const reader = await browser.newContext({ viewport: { width: 375, height: 812 } });
    const visitor = await reader.newPage();
    const opened = await visitor.goto(link.pathname);
    expect(opened?.status()).toBe(200);
    await expect(visitor.getByText("Weeknight dinners").first()).toBeVisible();
    await expect(visitor.getByText("Page 1")).toBeVisible();
    await expect(visitor.getByRole("link", { name: /weeknight dinners/i })).toHaveCount(0);
    await noOverflow(visitor);
    await visitor.screenshot({ path: path.join(shotRoot, "375-shared-reader.png") });

    await sheet.getByRole("button", { name: "Stop sharing" }).click();
    await expect(sheet.getByRole("button", { name: "Create link" })).toBeVisible();

    const revoked = await visitor.goto(link.pathname);
    expect(revoked?.status()).toBe(404);
    await reader.close();
  });

  test("a cookbook with published-book recipes offers no link", async ({ page }) => {
    test.setTimeout(90_000);
    const saved = await page.request.post(`/api/v1/books/imports/${TRIAGE_JOB}/recipes`, {
      data: { items: [{ candidateId: "lemon" }] },
      timeout: 60_000,
    });
    expect(saved.ok()).toBe(true);
    const { cookbookId } = await saved.json();
    expect(cookbookId).toBeTruthy();

    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto(`/recipes?cookbook=${cookbookId}`);
    await expect(page.getByRole("button", { name: "Share", exact: true })).toBeDisabled();
    await expect(
      page.getByText(/Sharing is off: Has recipes from a published cookbook/)
    ).toBeVisible();
    await page.screenshot({ path: path.join(shotRoot, "375-share-blocked.png") });

    const refused = await page.request.post(`/api/v1/cookbooks/${cookbookId}/share`);
    expect(refused.status()).toBe(409);
    expect((await refused.json()).code).toBe("share_blocked");
  });
});
