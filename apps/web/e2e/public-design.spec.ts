import { expect, test, type Page } from "@playwright/test";
import path from "node:path";

const pages = [
  { name: "home", path: "/" },
  { name: "docs", path: "/docs" },
  { name: "connect-your-agent", path: "/docs/connect-your-agent" },
  { name: "sign-in", path: "/sign-in" },
  { name: "404", path: "/this-does-not-exist" },
] as const;

const shotRoot = process.env.E2E_SHOT_DIR
  ? path.resolve(process.env.E2E_SHOT_DIR)
  : path.resolve(__dirname, "../../../e2e-artifacts/design");
const label = process.env.E2E_SHOT_LABEL || "current";

async function contrastRatio(page: Page, selector: string): Promise<number | null> {
  return page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    const style = getComputedStyle(el);
    const parse = (value: string): [number, number, number, number] | null => {
      const match = value.match(/rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?\)/);
      if (!match) return null;
      return [
        Number(match[1]),
        Number(match[2]),
        Number(match[3]),
        match[4] ? Number(match[4]) : 1,
      ];
    };
    const channel = (value: number) => {
      const scaled = value / 255;
      return scaled <= 0.03928 ? scaled / 12.92 : ((scaled + 0.055) / 1.055) ** 2.4;
    };
    const luminance = (rgb: [number, number, number]) =>
      0.2126 * channel(rgb[0]) + 0.7152 * channel(rgb[1]) + 0.0722 * channel(rgb[2]);
    const fg = parse(style.color);
    if (!fg) return null;
    let node: HTMLElement | null = el as HTMLElement;
    let bg: [number, number, number, number] | null = null;
    while (node) {
      const next = parse(getComputedStyle(node).backgroundColor);
      if (next && next[3] > 0) {
        bg = next;
        break;
      }
      node = node.parentElement;
    }
    if (!bg) return null;
    const l1 = luminance([fg[0], fg[1], fg[2]]);
    const l2 = luminance([bg[0], bg[1], bg[2]]);
    const lighter = Math.max(l1, l2);
    const darker = Math.min(l1, l2);
    return (lighter + 0.05) / (darker + 0.05);
  }, selector);
}

test.describe("public design sign-off", () => {
  test("keeps unknown public routes in-app and contrast above 4.5", async ({ page }, testInfo) => {
    const width = testInfo.project.name === "mobile" ? 390 : 1440;
    await page.setViewportSize({
      width,
      height: width === 390 ? 844 : 900,
    });
    await page.emulateMedia({ colorScheme: "dark" });

    for (const item of pages) {
      const errors: string[] = [];
      page.on("console", (msg) => {
        if (msg.type() === "error") errors.push(msg.text());
      });
      page.on("pageerror", (err) => errors.push(err.message));

      const response = await page.goto(item.path, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(800);

      expect(page.url()).not.toMatch(/accounts\.dev/);
      if (item.name === "404") {
        expect(response?.status()).toBe(404);
        await expect(page.getByRole("heading", { name: /couldn.t find that page/i })).toBeVisible();
        await expect(page.getByRole("link", { name: "Docs" })).toBeVisible();
        await expect(page.getByRole("link", { name: "Recipes" })).toHaveCount(0);
      }

      const scheme = await page.evaluate(
        () => getComputedStyle(document.documentElement).colorScheme
      );
      expect(scheme).toMatch(/light/);

      const primary = page.locator(".btn.primary").first();
      if (await primary.count()) {
        const ratio = await contrastRatio(page, ".btn.primary");
        expect(ratio, `${item.name} primary`).toBeGreaterThanOrEqual(4.5);
      }
      if (item.name === "home") {
        const step = await contrastRatio(page, ".path-card .kicker");
        const footer = await contrastRatio(page, ".footer");
        expect(step, "step number").toBeGreaterThanOrEqual(4.5);
        expect(footer, "footer").toBeGreaterThanOrEqual(4.5);
        await expect(page.locator(".hero .lead .nowrap")).toHaveText("Per-person");
      }
      if (item.name === "docs") {
        const label = await contrastRatio(page, ".docs-page .yours-row span");
        expect(label, "endpoint label").toBeGreaterThanOrEqual(4.5);
        const card = page.locator(".docs-page .yours-row li").last();
        const wrap = page.locator(".docs-page");
        const cardBox = await card.boundingBox();
        const wrapBox = await wrap.boundingBox();
        expect(cardBox && wrapBox).toBeTruthy();
        if (cardBox && wrapBox) {
          expect(cardBox.x).toBeLessThanOrEqual(wrapBox.x + 2);
          expect(cardBox.width).toBeGreaterThanOrEqual(wrapBox.width - 4);
        }
      }

      const authNoise = errors.filter(
        (text) =>
          /401|CORS|Failed to fetch RSC payload/i.test(text) &&
          /\/(recipes|plans|list|people|settings)/.test(text)
      );
      expect(authNoise, `${item.name} console`).toEqual([]);

      await page.screenshot({
        path: path.join(shotRoot, label, `${item.name}-${width}.png`),
        fullPage: true,
        animations: "disabled",
      });
      page.removeAllListeners("console");
      page.removeAllListeners("pageerror");
    }
  });
});
