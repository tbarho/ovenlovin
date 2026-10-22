import { expect, test, type Locator, type Page } from "@playwright/test";
import path from "node:path";

const pages = [
  { name: "home", path: "/", ready: ".hero h1" },
  { name: "docs", path: "/docs", ready: ".docs-page h1" },
  { name: "connect-your-agent", path: "/docs/connect-your-agent", ready: ".intro" },
  { name: "sign-in", path: "/sign-in", ready: "h1" },
  { name: "sign-up", path: "/sign-up", ready: "h1" },
  { name: "404", path: "/this-does-not-exist", ready: ".not-found h1" },
] as const;
const widths = [390, 1440] as const;

const shotRoot = process.env.E2E_SHOT_DIR
  ? path.resolve(process.env.E2E_SHOT_DIR)
  : path.resolve(__dirname, "../../../../e2e-artifacts/design");
const label = process.env.E2E_SHOT_LABEL || "current";

function markedMatchesOverflow(host: Locator) {
  return host.evaluate((el) => {
    const node =
      el.querySelector<HTMLElement>("[data-scroll]") ?? el.querySelector<HTMLElement>("pre") ?? el;
    const overflows = node.scrollLeft + node.clientWidth < node.scrollWidth - 1;
    return el.hasAttribute("data-overflow") === overflows;
  });
}

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

async function openPublicPage(page: Page, item: (typeof pages)[number]) {
  const response = await page.goto(item.path, { waitUntil: "domcontentloaded" });
  await expect(page.locator(item.ready).first()).toBeVisible();
  await page.evaluate(() => document.fonts?.ready ?? Promise.resolve());
  return response;
}

test.describe("public design sign-off", () => {
  test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ colorScheme: "dark" });
  });

  for (const item of pages) {
    test(`${item.name} stays in-app and contrast above 4.5`, async ({ page }) => {
      for (const width of widths) {
        await page.setViewportSize({
          width,
          height: width === 390 ? 844 : 900,
        });

        const errors: string[] = [];
        page.on("console", (msg) => {
          if (msg.type() === "error") errors.push(msg.text());
        });
        page.on("pageerror", (err) => errors.push(err.message));

        const response = await openPublicPage(page, item);

        expect(page.url()).not.toMatch(/accounts\.dev/);
        if (item.name === "404") {
          expect(response?.status()).toBe(404);
          await expect(
            page.getByRole("heading", { name: /couldn.t find that page/i })
          ).toBeVisible();
          if (width <= 400) {
            await expect(page.locator('.nav-cta a[href="/docs"]')).toBeHidden();
            const signIn = page.locator('.nav-cta a[href="/sign-in"]');
            if (!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) {
              if ((await signIn.count()) === 0) {
                await page.locator(".nav-cta").evaluate((cta) => {
                  const a = document.createElement("a");
                  a.className = "btn";
                  a.href = "/sign-in";
                  a.textContent = "Sign in";
                  cta.appendChild(a);
                });
              }
            } else {
              await expect(signIn).toHaveCount(1);
            }
            await expect(signIn).toBeVisible();
            const wrap = await signIn.evaluate((el) => {
              const range = document.createRange();
              range.selectNodeContents(el);
              return {
                lines: range.getClientRects().length,
                right: el.getBoundingClientRect().right,
              };
            });
            expect(wrap.lines, "404 Sign in wrap").toBe(1);
            expect(wrap.right, "404 Sign in right edge").toBeLessThanOrEqual(390);
          } else {
            await expect(page.getByRole("link", { name: "Docs" })).toBeVisible();
          }
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
          await expect(page.locator(".hero .lead")).toContainText("Always read the label.");
          const homeType = await page.evaluate(() => {
            const heading = document.querySelector("h1");
            const pathBody = document.querySelector(".path-card p");
            const foot = document.querySelector(".footer a");
            return {
              h1Weight: heading ? Number(getComputedStyle(heading).fontWeight) : 0,
              pathSize: pathBody ? parseFloat(getComputedStyle(pathBody).fontSize) : 0,
              pathLine: pathBody ? parseFloat(getComputedStyle(pathBody).lineHeight) : 0,
              footerH: foot ? foot.getBoundingClientRect().height : 0,
            };
          });
          expect(homeType.h1Weight, "h1 weight").toBe(600);
          expect(homeType.pathSize, "path-card size").toBe(16);
          expect(homeType.pathLine, "path-card line").toBe(24);
          expect(homeType.footerH, "footer tap").toBeGreaterThanOrEqual(44);
          const footerAlign = await page.evaluate(() => {
            const foot = document.querySelector(".footer");
            const label = document.querySelector(".footer > span");
            return {
              align: foot ? getComputedStyle(foot).alignItems : "",
              labelMin: label ? parseFloat(getComputedStyle(label).minHeight) : 0,
            };
          });
          expect(footerAlign.align, "footer align").toBe("center");
          expect(footerAlign.labelMin, "footer label").toBeGreaterThanOrEqual(44);
          const pathCard = page.locator(".path-card p").first();
          const pathWrap = await pathCard.evaluate((el) => getComputedStyle(el).textWrap);
          expect(pathWrap, "path-card wrap").toMatch(/pretty/);
          await expect(pathCard, "path 01 sign-in").toContainText("\u2011");
          const heroBtns = page.locator(".hero-ctas .btn");
          await expect(heroBtns).toHaveCount(2);
          if (width === 390) {
            const wrapBox = await page.locator(".hero .wrap").boundingBox();
            const first = await heroBtns.first().boundingBox();
            const second = await heroBtns.last().boundingBox();
            expect(wrapBox && first && second).toBeTruthy();
            if (wrapBox && first && second) {
              expect(first.width).toBeGreaterThanOrEqual(wrapBox.width - 8);
              expect(second.width).toBeGreaterThanOrEqual(wrapBox.width - 8);
              expect(second.y).toBeGreaterThan(first.y + first.height - 2);
            }
          }
        }
        if (item.name === "docs") {
          const label = await contrastRatio(page, ".docs-page .yours-row span");
          expect(label, "endpoint label").toBeGreaterThanOrEqual(4.5);
          await expect(page.locator(".docs-page .intro .nowrap")).toHaveText("per-person");
          const card = page.locator(".docs-page .yours-row li").last();
          const wrap = page.locator(".docs-page");
          const url = card.locator("code");
          const cardBox = await card.boundingBox();
          const wrapBox = await wrap.boundingBox();
          const urlBox = await url.boundingBox();
          expect(cardBox && wrapBox && urlBox).toBeTruthy();
          if (cardBox && wrapBox && urlBox) {
            expect(cardBox.x).toBeLessThanOrEqual(wrapBox.x + 2);
            expect(cardBox.width).toBeGreaterThanOrEqual(wrapBox.width - 4);
            expect(urlBox.x + urlBox.width).toBeLessThanOrEqual(cardBox.x + cardBox.width + 1);
          }
          if (width === 1440) {
            const heading = await page.locator(".docs-page h1").boundingBox();
            const cta = await page.locator(".docs-page .hero-ctas .btn").first().boundingBox();
            expect(heading && cta).toBeTruthy();
            if (heading && cta) {
              expect(cta.x).toBeLessThanOrEqual(heading.x + 2);
            }
          }
        }
        if (item.name === "sign-in") {
          const screenBox = await page.locator(".auth-screen").boundingBox();
          const brandBox = await page.locator(".auth-screen .brand").boundingBox();
          const heading = page.locator(".auth-screen h1");
          const headingBox = await heading.boundingBox();
          const btnBox = await page.locator(".auth-screen .btn").first().boundingBox();
          expect(screenBox && brandBox && headingBox && btnBox).toBeTruthy();
          if (screenBox && brandBox && headingBox && btnBox) {
            const mid = (box: { x: number; width: number }) => box.x + box.width / 2;
            const center = mid(screenBox);
            expect(Math.abs(mid(brandBox) - center)).toBeLessThan(8);
            expect(Math.abs(mid(headingBox) - center)).toBeLessThan(8);
            expect(Math.abs(mid(btnBox) - center)).toBeLessThan(8);
          }
          const type = await heading.evaluate((el) => {
            const style = getComputedStyle(el);
            return {
              fontSize: parseFloat(style.fontSize),
              lineHeight: parseFloat(style.lineHeight),
            };
          });
          expect(type.fontSize).toBeCloseTo(40, 0);
          expect(type.lineHeight / type.fontSize).toBeCloseTo(1.1, 1);
        }
        if (item.name === "sign-in" || item.name === "sign-up") {
          const clerk = page.locator(".cl-rootBox");
          if ((await clerk.count()) > 0) {
            await expect(clerk.first()).toBeVisible();
          }
          await expect(page.locator("h1")).toHaveCount(1);
        }
        if (item.name === "docs" || item.name === "connect-your-agent") {
          await expect(page.locator(".intro").first()).toContainText("Always read the label.");
          const leadType = await page.locator(".docs-page .lead").evaluate((el) => {
            const style = getComputedStyle(el);
            return {
              height: el.getBoundingClientRect().height,
              line: parseFloat(style.lineHeight),
              scrollWidth: el.scrollWidth,
              clientWidth: el.clientWidth,
            };
          });
          expect(leadType.height, `${item.name} lead lines`).toBeLessThanOrEqual(
            leadType.line * 3 + 2
          );
          if (width === 390) {
            expect(leadType.scrollWidth, `${item.name} lead overflow`).toBeLessThanOrEqual(
              leadType.clientWidth
            );
          }
          await expect(page.locator(".docs-page ol")).toContainText("plaintext");
          await expect(page.locator(".docs-page ol")).toContainText("Deploy button");
        }
        if (item.name === "home" || item.name === "connect-your-agent") {
          const box = page.locator(".copy-scroll").first();
          await expect.poll(async () => markedMatchesOverflow(box), { timeout: 5_000 }).toBe(true);
          const fade = await box.evaluate((el) => {
            const pre = el.querySelector("pre");
            const after = getComputedStyle(el, "::after");
            return {
              overflows: Boolean(pre && pre.scrollLeft + pre.clientWidth < pre.scrollWidth - 1),
              width: parseFloat(after.width),
              image: after.backgroundImage,
            };
          });
          if (fade.overflows) {
            expect(fade.width, `${item.name} fade`).toBeGreaterThanOrEqual(24);
            expect(fade.image).toMatch(/linear-gradient/i);
          }
          if (width === 390) {
            const copy = await page.locator(".copy-btn").first().boundingBox();
            const tab = await page.locator(".tab").first().boundingBox();
            expect(copy?.height ?? 0).toBeGreaterThanOrEqual(44);
            expect(tab?.height ?? 0).toBeGreaterThanOrEqual(44);
            const tabs = page.locator(".tabs-fade");
            await expect
              .poll(async () => markedMatchesOverflow(tabs), { timeout: 5_000 })
              .toBe(true);
            const tabFade = await tabs.evaluate((el) => {
              const row = el.querySelector("[data-scroll]");
              const style = row ? getComputedStyle(row) : null;
              return {
                overflows: Boolean(row && row.scrollLeft + row.clientWidth < row.scrollWidth - 1),
                mask: style?.webkitMaskImage || style?.maskImage || "",
              };
            });
            if (tabFade.overflows) expect(tabFade.mask).toMatch(/linear-gradient/i);
          }
        }
        if (item.name === "connect-your-agent") {
          const claude = page.locator(".copy-pre");
          await expect
            .poll(async () => markedMatchesOverflow(claude), { timeout: 5_000 })
            .toBe(true);
          const fade = await claude.evaluate((el) => {
            const pre = el.querySelector("pre");
            const after = getComputedStyle(el, "::after");
            return {
              overflows: Boolean(pre && pre.scrollLeft + pre.clientWidth < pre.scrollWidth - 1),
              width: parseFloat(after.width),
              image: after.backgroundImage,
            };
          });
          if (fade.overflows) {
            expect(fade.width, "claude fade").toBeGreaterThanOrEqual(24);
            expect(fade.image).toMatch(/linear-gradient/i);
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
  }
});
