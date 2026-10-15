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

const BLOCKED_STATUSES = new Set([401, 402, 403, 406, 429, 451, 503]);
const CACHE_FETCH_MS = 12_000;

let installedRenderer: RecipePageRenderer | undefined;

export function installRecipePageRenderer(renderer: RecipePageRenderer | undefined): void {
  installedRenderer = renderer;
}

export function getRecipePageRenderer(): RecipePageRenderer | undefined {
  return installedRenderer;
}

export class RecipeImportFetchError extends Error {
  readonly status: number;
  readonly url: string;

  constructor(url: string, status: number, statusText: string) {
    super(importBlockedMessage(status, statusText || "Forbidden"));
    this.name = "RecipeImportFetchError";
    this.status = status;
    this.url = url;
  }
}

export function shouldRetryFetchWithBrowserHeaders(status: number): boolean {
  return BLOCKED_STATUSES.has(status);
}

export function importBlockedMessage(_status?: number, _statusText?: string): string {
  return "This site blocked the importer. Try importing by pasting the recipe text instead.";
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

/** Wayback Athena / JS playback shell: not the archived article. */
export function looksLikeWaybackShell(html: string): boolean {
  const head = html.slice(0, 12_000).toLowerCase();
  if (head.includes("athena.js") || head.includes("playback.bundle.js")) return true;
  const titledWayback = /<title>[^<]*wayback machine[^<]*<\/title>/i.test(html.slice(0, 4000));
  return titledWayback && html.length < 20_000 && !/application\/ld\+json/i.test(html);
}

export function isUsableRecipeHtml(html: string): boolean {
  if (!html || looksLikeBotChallenge(html) || looksLikeWaybackShell(html)) return false;
  const compact = html.replace(/\s+/g, " ").trim();
  if (compact.length < 400) return false;
  if (/application\/ld\+json/i.test(html) && /Recipe/i.test(html)) return true;
  if (/itemprop=["']recipe/i.test(html)) return true;
  if (/h-ingredient|p-ingredient|ingredient-name/i.test(html)) return true;
  if (
    /<(h1|h2|h3|h4)[^>]*>[\s\S]{0,240}(ingredient|procedure|instruction|direction|method)/i.test(
      html
    )
  ) {
    return true;
  }
  if (/["']Recipe["']/.test(html)) return true;
  return looksLikeMarkdownRecipe(html);
}

export function looksLikeMarkdownRecipe(text: string): boolean {
  if (!text || looksLikeBotChallenge(text)) return false;
  const compact = text.replace(/\s+/g, " ").trim();
  if (compact.length < 400) return false;
  const hasIngredients =
    /^#{1,4}\s+ingredients?\b/im.test(text) ||
    /\bingredients?\b/i.test(text.slice(0, 12_000)) ||
    /[\u25A0-\u25A3\u25FB-\u25FE\u2610-\u2612]/.test(text);
  const hasSteps =
    /^#{1,4}\s+(instructions?|directions?|method|procedure|steps?)\b/im.test(text) ||
    /\b(instructions?|directions?|method|procedure)\b/i.test(text);
  return hasIngredients && hasSteps;
}

export function waybackMachineUrl(url: string): string {
  return `https://web.archive.org/web/2/${url}`;
}

export function waybackIdentityUrl(url: string): string {
  return `https://web.archive.org/web/2id_/${url}`;
}

export function waybackSnapshotIdentityUrl(timestamp: string, url: string): string {
  return `https://web.archive.org/web/${timestamp}id_/${url}`;
}

export function waybackAvailableUrl(url: string): string {
  return `https://archive.org/wayback/available?url=${encodeURIComponent(url)}`;
}

export function jinaReaderUrl(url: string): string {
  return `https://r.jina.ai/${url}`;
}

/** People Inc. sites (Allrecipes, Simply Recipes) exclude Jina; this copy still has JSON-LD. */
export function googleTranslateUrl(url: string): string {
  return `https://translate.google.com/translate?sl=auto&tl=en&u=${encodeURIComponent(url)}`;
}

export function translateGoogUrl(url: string): string {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return googleTranslateUrl(url);
  }
  const host = parsed.hostname.replace(/\./g, "-");
  const query = parsed.search ? `${parsed.search}&` : "?";
  return `https://${host}.translate.goog${parsed.pathname}${query}_x_tr_sl=auto&_x_tr_tl=en&_x_tr_hl=en`;
}

export type PublicCopy = {
  url: string;
  headers?: Record<string, string>;
};

/**
 * Free public copies. Wayback identity first (raw HTML, no Athena toolbar),
 * then rewritten Wayback, Jina HTML, Jina markdown, Google Translate.
 */
export function publicCopyRequests(url: string): PublicCopy[] {
  return [
    { url: waybackIdentityUrl(url) },
    { url: waybackMachineUrl(url) },
    { url: jinaReaderUrl(url), headers: { "X-Return-Format": "html" } },
    { url: jinaReaderUrl(url) },
    { url: googleTranslateUrl(url) },
    { url: translateGoogUrl(url) },
  ];
}

/** Wikibooks Cookbook:Pancakes is a 404; Cookbook:Pancake is the live page. */
export function relatedRecipeUrls(url: string): string[] {
  try {
    const parsed = new URL(url);
    if (!/wikibooks\.org$/i.test(parsed.hostname)) return [];
    const match = parsed.pathname.match(/^(.*\/Cookbook:[^/]+?)s\/?$/i);
    if (!match?.[1]) return [];
    const next = new URL(parsed.href);
    next.pathname = match[1];
    return next.href !== url ? [next.href] : [];
  } catch {
    return [];
  }
}

function cacheFallbackEnabled(env: Record<string, string | undefined>): boolean {
  return env.RECIPE_IMPORT_CACHE_FALLBACK !== "0";
}

function abortSignal(ms: number): AbortSignal | undefined {
  const timeout = (
    globalThis.AbortSignal as { timeout?: (value: number) => AbortSignal } | undefined
  )?.timeout;
  return typeof timeout === "function" ? timeout(ms) : undefined;
}

async function readResponse(
  fetchImpl: typeof fetch,
  url: string,
  extraHeaders?: Record<string, string>,
  timeoutMs = CACHE_FETCH_MS
): Promise<{ ok: boolean; status: number; statusText: string; html: string; finalUrl: string }> {
  const response = await fetchImpl(url, {
    headers: { ...FULL_BROWSER_HEADERS, ...extraHeaders },
    redirect: "follow",
    signal: abortSignal(timeoutMs),
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

async function usableCopy(
  fetchImpl: typeof fetch,
  url: string,
  extraHeaders?: Record<string, string>
): Promise<FetchResult | null> {
  const cached = await readResponse(fetchImpl, url, extraHeaders);
  if (cached.ok && isUsableRecipeHtml(cached.html)) {
    return { html: cached.html, url, finalUrl: url, via: "cache" };
  }
  return null;
}

type WaybackAvailable = {
  archived_snapshots?: { closest?: { timestamp?: string; status?: string } };
};

async function resolveWaybackSnapshot(
  fetchImpl: typeof fetch,
  url: string
): Promise<string | null> {
  try {
    const response = await readResponse(
      fetchImpl,
      waybackAvailableUrl(url),
      { Accept: "application/json" },
      8_000
    );
    if (!response.ok) return null;
    const data = JSON.parse(response.html) as WaybackAvailable;
    const closest = data.archived_snapshots?.closest;
    if (!closest?.timestamp || closest.status !== "200") return null;
    return waybackSnapshotIdentityUrl(closest.timestamp, url);
  } catch {
    return null;
  }
}

/**
 * Layered recipe-page fetch:
 * 1. Direct HTTP with a full browser header set (plus close URL variants)
 * 2. Public copies first so Vercel 10s limits do not die in headless Chromium
 * 3. Optional headless Chromium last
 */
export async function fetchHtml(url: string, options: FetchHtmlOptions = {}): Promise<FetchResult> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const env = options.env ?? process.env;
  const renderPage = options.renderPage ?? getRecipePageRenderer();

  let lastStatus = 403;
  let lastStatusText = "Forbidden";
  const candidates = [url, ...relatedRecipeUrls(url)];

  for (const candidate of candidates) {
    try {
      const direct = await readResponse(fetchImpl, candidate);
      lastStatus = direct.status;
      lastStatusText = direct.statusText;
      if (direct.ok && isUsableRecipeHtml(direct.html)) {
        return { html: direct.html, url, finalUrl: direct.finalUrl, via: "direct" };
      }
    } catch {
      lastStatus = 503;
      lastStatusText = "Fetch failed";
    }
  }

  if (cacheFallbackEnabled(env)) {
    for (const candidate of candidates) {
      const snapshot = await resolveWaybackSnapshot(fetchImpl, candidate);
      const copies = [
        ...(snapshot ? [{ url: snapshot }] : []),
        ...publicCopyRequests(candidate),
      ];
      for (const copy of copies) {
        try {
          const hit = await usableCopy(fetchImpl, copy.url, copy.headers);
          if (hit) return { ...hit, url };
        } catch {
          // try the next public copy
        }
      }
    }
  }

  if (renderPage) {
    try {
      const rendered = await renderPage(url);
      if (rendered && isUsableRecipeHtml(rendered)) {
        return { html: rendered, url, finalUrl: url, via: "headless" };
      }
    } catch {
      // already tried cache
    }
  }

  throw new RecipeImportFetchError(url, lastStatus, lastStatusText);
}
