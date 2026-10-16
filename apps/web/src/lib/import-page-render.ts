import { existsSync } from "node:fs";
import { CHROME_USER_AGENT, installRecipePageRenderer } from "@ovenlovin/importers";

/** Public Chromium pack for `@sparticuz/chromium-min` (no paid CDN). Override with RECIPE_IMPORT_CHROMIUM_PACK_URL. */
export const DEFAULT_CHROMIUM_PACK_URL =
  "https://github.com/Sparticuz/chromium/releases/download/v133.0.0/chromium-v133.0.0-pack.tar";

export const HEADLESS_GOTO_MS = 18_000;
export const HEADLESS_IDLE_MS = 8_000;
export const HEADLESS_CHALLENGE_MS = 8_000;

/** Common consent / cookie walls on recipe sites. */
export const CONSENT_BUTTON_SELECTORS = [
  "#onetrust-accept-btn-handler",
  "#accept-all-cookies",
  "button[id*='accept' i]",
  "button[class*='accept' i]",
  "button[data-testid*='accept' i]",
  "button[aria-label*='accept' i]",
  "button[aria-label*='agree' i]",
];

export const CONSENT_BUTTON_LABELS = [
  "accept all",
  "accept cookies",
  "i agree",
  "agree",
  "got it",
  "allow all",
];

export const STEALTH_INIT_SCRIPT = `Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
window.chrome = window.chrome || { runtime: {} };`;

export function isConsentButtonLabel(text: string): boolean {
  const normalized = text.replace(/\s+/g, " ").trim().toLowerCase();
  return CONSENT_BUTTON_LABELS.some(
    (label) => normalized === label || normalized.startsWith(`${label} `)
  );
}

async function resolveChrome(): Promise<{ executablePath: string; args: string[] } | null> {
  if (process.env.VERCEL) {
    const { default: chromium } = await import("@sparticuz/chromium-min");
    chromium.setGraphicsMode = false;
    const packUrl = process.env.RECIPE_IMPORT_CHROMIUM_PACK_URL || DEFAULT_CHROMIUM_PACK_URL;
    return {
      executablePath: await chromium.executablePath(packUrl),
      args: chromium.args,
    };
  }

  const local =
    process.env.RECIPE_IMPORT_CHROME_PATH ||
    process.env.CHROME_PATH ||
    "/usr/local/bin/google-chrome";
  if (!existsSync(local)) return null;
  return {
    executablePath: local,
    args: [
      "--no-sandbox",
      "--disable-gpu",
      "--disable-dev-shm-usage",
      "--disable-setuid-sandbox",
      "--hide-scrollbars",
    ],
  };
}

type HeadlessPage = {
  setUserAgent(ua: string): Promise<void>;
  setViewport(size: { width: number; height: number }): Promise<void>;
  setExtraHTTPHeaders(headers: Record<string, string>): Promise<void>;
  evaluateOnNewDocument(fn: string | (() => void)): Promise<void>;
  goto(url: string, options: { waitUntil: string; timeout: number }): Promise<unknown>;
  waitForNetworkIdle?(options: { idleTime?: number; timeout: number }): Promise<void>;
  waitForFunction(fn: () => boolean, options: { timeout: number }): Promise<unknown>;
  evaluate<T>(fn: () => T): Promise<T>;
  content(): Promise<string>;
  title(): Promise<string>;
};

export async function applyStealthPage(page: HeadlessPage): Promise<void> {
  await page.setUserAgent(CHROME_USER_AGENT);
  await page.setViewport({ width: 1365, height: 900 });
  await page.setExtraHTTPHeaders({ "Accept-Language": "en-US,en;q=0.9" });
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, "webdriver", { get: () => undefined });
    Object.defineProperty(navigator, "languages", { get: () => ["en-US", "en"] });
    Object.defineProperty(navigator, "plugins", { get: () => [1, 2, 3, 4, 5] });
    const win = window as unknown as { chrome?: { runtime: object } };
    win.chrome = win.chrome || { runtime: {} };
  });
}

export async function dismissConsentWall(page: HeadlessPage): Promise<boolean> {
  return page.evaluate(() => {
    const labels = ["accept all", "accept cookies", "i agree", "agree", "got it", "allow all"];
    const selectors = [
      "#onetrust-accept-btn-handler",
      "#accept-all-cookies",
      "button[id*='accept' i]",
      "button[class*='accept' i]",
      "button[data-testid*='accept' i]",
      "button[aria-label*='accept' i]",
      "button[aria-label*='agree' i]",
    ];
    for (const selector of selectors) {
      const el = document.querySelector(selector);
      if (el instanceof HTMLElement) {
        el.click();
        return true;
      }
    }
    const buttons = Array.from(document.querySelectorAll("button, [role='button']"));
    for (const button of buttons) {
      const text = (button.textContent || "").replace(/\s+/g, " ").trim().toLowerCase();
      if (labels.some((label) => text === label || text.startsWith(`${label} `))) {
        if (button instanceof HTMLElement) {
          button.click();
          return true;
        }
      }
    }
    return false;
  });
}

/** Headless Chromium render for Cloudflare-protected recipe pages. Disable with RECIPE_IMPORT_HEADLESS=0. */
export async function renderRecipePage(url: string): Promise<string | null> {
  if (process.env.RECIPE_IMPORT_HEADLESS === "0") return null;

  try {
    const chrome = await resolveChrome();
    if (!chrome) return null;
    const puppeteer = await import("puppeteer-core");
    const browser = await puppeteer.default.launch({
      executablePath: chrome.executablePath,
      args: [
        ...chrome.args,
        "--disable-blink-features=AutomationControlled",
        "--window-size=1365,900",
      ],
      headless: true,
      ignoreDefaultArgs: ["--enable-automation"],
    });
    try {
      const page = (await browser.newPage()) as unknown as HeadlessPage;
      await applyStealthPage(page);
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: HEADLESS_GOTO_MS });
      if (typeof page.waitForNetworkIdle === "function") {
        await page
          .waitForNetworkIdle({ idleTime: 500, timeout: HEADLESS_IDLE_MS })
          .catch(() => undefined);
      }
      await page
        .waitForFunction(() => !/just a moment/i.test(document.title), {
          timeout: HEADLESS_CHALLENGE_MS,
        })
        .catch(() => undefined);
      await dismissConsentWall(page).catch(() => false);
      const html = await page.content();
      if (/just a moment/i.test(await page.title())) return null;
      return html;
    } finally {
      await browser.close();
    }
  } catch {
    return null;
  }
}

export function registerRecipePageRenderer(): void {
  installRecipePageRenderer(renderRecipePage);
}
