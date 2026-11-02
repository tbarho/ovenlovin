import { expect, test, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import path from "node:path";

const shotRoot = path.resolve(__dirname, "../../../../e2e-artifacts/kitchen/book-index-fit");

/** Every index entry on the shown index pages sits inside its page, clear of the folio. */
async function shownIndexPages(page: Page) {
  return page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>(".book-page--index")]
      .filter((el) => el.getBoundingClientRect().width > 0)
      .map((el) => {
        const box = el.getBoundingClientRect();
        const folio = el.querySelector(".book-page-number")!.getBoundingClientRect();
        const entries = [...el.querySelectorAll(".book-index li")];
        const clipped = entries
          .filter((li) => {
            const r = li.getBoundingClientRect();
            const outside =
              r.top < box.top - 0.5 || r.bottom > box.bottom + 0.5 || r.right > box.right + 0.5;
            const onFolio =
              r.bottom > folio.top &&
              r.top < folio.bottom &&
              r.right > folio.left &&
              r.left < folio.right;
            return outside || onFolio;
          })
          .map((li) => li.textContent);
        return {
          number: el.querySelector(".book-page-number")!.textContent!,
          entries: entries.length,
          clipped,
        };
      })
  );
}

test.describe("book index fits the page", () => {
  test("a dense index stays inside its pages at phone and tablet widths", async ({ page }) => {
    test.setTimeout(240_000);
    // Every seeded recipe in one book gives an index that fills a page.
    const recipes = await page.request.get("/api/v1/recipes?limit=100");
    expect(recipes.status()).toBe(200);
    const { items } = (await recipes.json()) as { items: Array<{ id: string }> };
    const created = await page.request.post("/api/v1/cookbooks", {
      data: { name: "Index fit book" },
    });
    expect(created.status()).toBe(201);
    const { id } = (await created.json()) as { id: string };

    try {
      for (const recipe of items) {
        const added = await page.request.post(`/api/v1/cookbooks/${id}/recipes`, {
          data: { recipeId: recipe.id },
        });
        expect(added.status()).toBe(200);
      }

      for (const viewport of [
        { width: 390, height: 844 },
        { width: 768, height: 1024 },
      ]) {
        await page.setViewportSize(viewport);
        await page.goto(`/cookbooks/${id}/book`);
        await expect(page.locator(".book-page").first()).toBeVisible({ timeout: 60_000 });
        // The page-relative type size applies inside page-flip's page.
        const fontSize = await page
          .locator(".book-page-in")
          .first()
          .evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
        const pageHeight = await page
          .locator(".book-page")
          .first()
          .evaluate((el) => el.getBoundingClientRect().height);
        expect(fontSize).toBeCloseTo(pageHeight / 56, 0);

        const total = Number(
          (await page.locator(".book-reader-total").textContent())!.replace(/\D/g, "")
        );
        const seen = new Map<string, { entries: number; clipped: (string | null)[] }>();
        for (let step = 0; step <= total; step++) {
          for (const shown of await shownIndexPages(page)) {
            if (seen.has(shown.number)) continue;
            seen.set(shown.number, shown);
            mkdirSync(shotRoot, { recursive: true });
            await page.screenshot({
              path: path.join(shotRoot, `${viewport.width}-index-p${shown.number}.png`),
            });
          }
          if (seen.size && (await page.locator(".book-page--notes:visible").count())) break;
          await page.keyboard.press("ArrowRight");
          await page.waitForTimeout(750);
        }

        const pages = [...seen.values()];
        expect(pages.length).toBeGreaterThan(0);
        // Dense enough to have filled a page, or the check proves nothing.
        expect(Math.max(...pages.map((p) => p.entries))).toBeGreaterThanOrEqual(40);
        expect(pages.flatMap((p) => p.clipped)).toEqual([]);
      }
    } finally {
      await page.request.delete(`/api/v1/cookbooks/${id}`);
    }
  });
});
