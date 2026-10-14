import { existsSync } from "node:fs";
import { CHROME_USER_AGENT, installRecipePageRenderer } from "@ovenlovin/importers";

async function resolveChrome(): Promise<{ executablePath: string; args: string[] } | null> {
  if (process.env.VERCEL) {
    const { default: chromium } = await import("@sparticuz/chromium");
    chromium.setGraphicsMode = false;
    return {
      executablePath: await chromium.executablePath(),
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
      const page = await browser.newPage();
      await page.setUserAgent(CHROME_USER_AGENT);
      await page.setViewport({ width: 1365, height: 900 });
      await page.setExtraHTTPHeaders({ "Accept-Language": "en-US,en;q=0.9" });
      await page.evaluateOnNewDocument(() => {
        Object.defineProperty(navigator, "webdriver", { get: () => undefined });
      });
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 20_000 });
      await page
        .waitForFunction(() => !/just a moment/i.test(document.title), { timeout: 8_000 })
        .catch(() => undefined);
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
