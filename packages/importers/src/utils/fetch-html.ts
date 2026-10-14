/* eslint-disable no-undef */

export interface FetchResult {
  html: string;
  url: string;
  finalUrl: string;
  via: "direct" | "headless" | "cache";
}

export type RecipePageRenderer = (url: string) => Promise<string | null>;

export type FetchHtmlOptions = {
  fetchImpl?: typeof fetch;
  renderPage?: RecipePageRenderer;
  env?: Record<string, string | undefined>;
};

export const CHROME_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

/** Full Chrome document navigation headers, including Client Hints and Fetch Metadata. */
export const FULL_BROWSER_HEADERS: Record<string, string> = {
  "User-Agent": CHROME_USER_AGENT,
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
  "Accept-Language": "en-US,en;q=0.9",
  "Cache-Control": "max-age=0",
  "Upgrade-Insecure-Requests": "1",
  "sec-ch-ua": '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
  "sec-ch-ua-mobile": "?0",
  "sec-ch-ua-platform": '"Windows"',
  "sec-fetch-dest": "document",
  "sec-fetch-mode": "navigate",
  "sec-fetch-site": "none",
  "sec-fetch-user": "?1",
};

const BLOCKED_STATUSES = new Set([401, 402, 403, 406, 429, 503]);

let installedRenderer: RecipePageRenderer | undefined;

export function installRecipePageRenderer(renderer: RecipePageRenderer | undefined): void {
  installedRenderer = renderer;
}

export function getRecipePageRenderer(): RecipePageRenderer | undefined {
  return installedRenderer;
}

export class RecipeImportFetchError extends Error {
  readonly status: number;

  constructor(url: string, status: number, statusText: string) {
    super(importBlockedMessage(status, statusText || "Forbidden"));
    this.name = "RecipeImportFetchError";
    this.status = status;
  }
}

export function shouldRetryFetchWithBrowserHeaders(status: number): boolean {
  return BLOCKED_STATUSES.has(status);
}

export function importBlockedMessage(status: number, statusText = "Forbidden"): string {
  return `This site blocked the importer (${status} ${statusText}). Try importing by pasting the recipe text instead.`;
}

export function looksLikeBotChallenge(html: string): boolean {
  const head = html.slice(0, 8000).toLowerCase();
  return (
    head.includes("just a moment") ||
    head.includes("cf-browser-verification") ||
    head.includes("cdn-cgi/challenge") ||
    head.includes("cf-challenge") ||
    head.includes("enable javascript and cookies to continue") ||
    (head.includes("attention required") && head.includes("cloudflare"))
  );
}

export function isUsableRecipeHtml(html: string): boolean {
  if (!html || looksLikeBotChallenge(html)) return false;
  return /application\/ld\+json/i.test(html) && /["']Recipe["']/.test(html);
}

export function waybackMachineUrl(url: string): string {
  return `https://web.archive.org/web/2/${url}`;
}

export function jinaReaderUrl(url: string): string {
  return `https://r.jina.ai/${url}`;
}

export type PublicCopy = {
  url: string;
  headers?: Record<string, string>;
};

/** Free public copies: Wayback first, then Jina Reader HTML (no API key). */
export function publicCopyRequests(url: string): PublicCopy[] {
  return [
    { url: waybackMachineUrl(url) },
    { url: jinaReaderUrl(url), headers: { "X-Return-Format": "html" } },
  ];
}

function cacheFallbackEnabled(env: Record<string, string | undefined>): boolean {
  return env.RECIPE_IMPORT_CACHE_FALLBACK !== "0";
}

async function readResponse(
  fetchImpl: typeof fetch,
  url: string,
  extraHeaders?: Record<string, string>
): Promise<{ ok: boolean; status: number; statusText: string; html: string; finalUrl: string }> {
  const response = await fetchImpl(url, {
    headers: { ...FULL_BROWSER_HEADERS, ...extraHeaders },
    redirect: "follow",
  });
  const html = await response.text();
  return {
    ok: response.ok,
    status: response.status,
    statusText: response.statusText,
    html,
    finalUrl: response.url || url,
  };
}

/**
 * Layered recipe-page fetch:
 * 1. Direct HTTP with a full browser header set
 * 2. Optional headless Chromium (injected renderer)
 * 3. Public Wayback Machine copy
 */
export async function fetchHtml(url: string, options: FetchHtmlOptions = {}): Promise<FetchResult> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const env = options.env ?? process.env;
  const renderPage = options.renderPage ?? getRecipePageRenderer();

  let lastStatus = 403;
  let lastStatusText = "Forbidden";

  try {
    const direct = await readResponse(fetchImpl, url);
    lastStatus = direct.status;
    lastStatusText = direct.statusText;
    if (direct.ok && isUsableRecipeHtml(direct.html)) {
      return { html: direct.html, url, finalUrl: direct.finalUrl, via: "direct" };
    }
  } catch {
    lastStatus = 503;
    lastStatusText = "Fetch failed";
  }

  if (renderPage) {
    try {
      const rendered = await renderPage(url);
      if (rendered && isUsableRecipeHtml(rendered)) {
        return { html: rendered, url, finalUrl: url, via: "headless" };
      }
    } catch {
      // fall through to public cache
    }
  }

  if (cacheFallbackEnabled(env)) {
    for (const copy of publicCopyRequests(url)) {
      try {
        const cached = await readResponse(fetchImpl, copy.url, copy.headers);
        if (cached.ok && isUsableRecipeHtml(cached.html)) {
          return { html: cached.html, url, finalUrl: url, via: "cache" };
        }
      } catch {
        // try the next public copy
      }
    }
  }

  throw new RecipeImportFetchError(url, lastStatus, lastStatusText);
}
