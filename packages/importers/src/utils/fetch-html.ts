/* eslint-disable no-undef */
import * as cheerio from "cheerio";
import {
  IMPORT_BLOCKED_MESSAGE,
  IMPORT_NOT_A_RECIPE_MESSAGE,
  IMPORT_PAGE_GONE_MESSAGE,
  IMPORT_UNSUPPORTED_SITE_MESSAGE,
  parseIngredientLine,
} from "@ovenlovin/core";
import { remainingImportBudgetMs } from "./models";
import { publicCopyRequests, relatedRecipeUrls, type PublicCopy } from "./public-copies";

export type FetchLayer = "direct" | "related" | "cache";

export interface FetchResult {
  html: string;
  url: string;
  finalUrl: string;
  via: FetchLayer;
  layersTried: string[];
  directStatus?: number;
  directBlocked: boolean;
}

export type FetchHtmlOptions = {
  fetchImpl?: typeof fetch;
  env?: Record<string, string | undefined>;
  sleep?: (ms: number) => Promise<void>;
  startedAt?: number;
};

/** Current Firefox. Food Network 403s an old Chrome UA without Accept-Encoding. */
export const FIREFOX_USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:144.0) Gecko/20100101 Firefox/144.0";

/** @deprecated Use FIREFOX_USER_AGENT. Kept so existing imports keep working. */
export const CHROME_USER_AGENT = FIREFOX_USER_AGENT;

/**
 * One consistent Firefox document navigation set, including Accept-Encoding.
 * Node 20 fetch decompresses gzip, deflate, and br automatically.
 * Do not mix Chrome Client Hints with a Firefox UA.
 */
export const FULL_BROWSER_HEADERS: Record<string, string> = {
  "User-Agent": FIREFOX_USER_AGENT,
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.5",
  "Accept-Encoding": "gzip, deflate, br",
  "Upgrade-Insecure-Requests": "1",
  "Sec-Fetch-Dest": "document",
  "Sec-Fetch-Mode": "navigate",
  "Sec-Fetch-Site": "none",
  "Sec-Fetch-User": "?1",
  DNT: "1",
  Connection: "keep-alive",
};

const BLOCKED_STATUSES = new Set([401, 402, 403, 406, 429, 451, 503]);
const CACHE_FETCH_MS = 12_000;

export class RecipeImportFetchError extends Error {
  readonly status: number;
  readonly url: string;
  readonly layersTried: string[];

  constructor(url: string, status: number, statusText: string, layersTried: string[] = []) {
    super(IMPORT_BLOCKED_MESSAGE);
    this.name = "RecipeImportFetchError";
    this.status = status;
    this.url = url;
    this.layersTried = layersTried;
  }
}

/** Page was fetched, but it is not a recipe. Not a block. */
export class RecipeNotFoundError extends Error {
  readonly url: string;
  readonly layersTried: string[];
  readonly directBlocked: boolean;

  constructor(url: string, layersTried: string[] = [], directBlocked = false) {
    super(IMPORT_NOT_A_RECIPE_MESSAGE);
    this.name = "RecipeNotFoundError";
    this.url = url;
    this.layersTried = layersTried;
    this.directBlocked = directBlocked;
  }
}

/** Direct fetch was a 404 and no public copy had a recipe. */
export class RecipePageGoneError extends Error {
  readonly url: string;

  constructor(url: string) {
    super(IMPORT_PAGE_GONE_MESSAGE);
    this.name = "RecipePageGoneError";
    this.url = url;
  }
}

/** Social hosts we cannot fetch a recipe from. */
export class RecipeUnsupportedSiteError extends Error {
  readonly url: string;

  constructor(url: string) {
    super(IMPORT_UNSUPPORTED_SITE_MESSAGE);
    this.name = "RecipeUnsupportedSiteError";
    this.url = url;
  }
}

export function isUnsupportedImportUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return host === "instagram.com" || host.endsWith(".instagram.com");
  } catch {
    return false;
  }
}

export function shouldRetryFetchWithBrowserHeaders(status: number): boolean {
  return BLOCKED_STATUSES.has(status);
}

export function formatLayersTried(layersTried: string[]): string {
  return layersTried.length > 0 ? layersTried.join(", ") : "direct";
}

export function importBlockedMessage(
  _layersTried: string[] | number = [],
  _status?: number,
  _statusText?: string
): string {
  return IMPORT_BLOCKED_MESSAGE;
}

export function looksLikeBotChallenge(html: string): boolean {
  const head = html.slice(0, 20_000).toLowerCase();
  return (
    head.includes("just a moment") ||
    head.includes("cf-browser-verification") ||
    head.includes("cdn-cgi/challenge") ||
    head.includes("cf-challenge") ||
    head.includes("enable javascript and cookies to continue") ||
    head.includes("verify you are human") ||
    head.includes("checking your browser") ||
    head.includes("vercel security checkpoint") ||
    (head.includes("security checkpoint") && head.includes("vercel")) ||
    (head.includes("attention required") && head.includes("cloudflare")) ||
    head.includes("_vercel_s") ||
    head.includes("vercel-challenge")
  );
}

export function looksLikeGonePage(html: string): boolean {
  if (!html || looksLikeBotChallenge(html) || looksLikeSoftBlock(html)) return false;
  const title = /<title[^>]*>([^<]*)<\/title>/i.exec(html)?.[1]?.toLowerCase() ?? "";
  if (/(404|page not found|\bnot found\b)/.test(title)) return true;
  const head = html.slice(0, 20_000).toLowerCase();
  return (
    /this recipe has been (removed|moved|deleted)/.test(head) ||
    /the recipe you.{0,60}has been (moved|removed)/.test(head) ||
    /<(h1|h2)[^>]*>[^<]{0,80}(404|page not found)[^<]{0,40}<\/\1>/i.test(html)
  );
}

export function looksLikeSoftBlock(html: string): boolean {
  const head = html.slice(0, 8000).toLowerCase();
  return (
    /access denied/.test(head) ||
    /request unsuccessful/.test(head) ||
    /unusual traffic/.test(head) ||
    /pardon our interruption/.test(head) ||
    /are you (a )?robot/.test(head)
  );
}

export function looksLikePaywall(html: string): boolean {
  const head = html.slice(0, 12_000).toLowerCase();
  return /subscribe to (continue|read)|create a free account to (continue|read)|subscribers only|metered paywall|you have (reached )?the (article )?limit/.test(
    head
  );
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

function isRecipeType(value: unknown): boolean {
  if (value === "Recipe") return true;
  return Array.isArray(value) && value.includes("Recipe");
}

function findRecipeNode(data: unknown): Record<string, unknown> | null {
  if (!data || typeof data !== "object") return null;
  if (Array.isArray(data)) {
    for (const item of data) {
      const found = findRecipeNode(item);
      if (found) return found;
    }
    return null;
  }
  const obj = data as Record<string, unknown>;
  if (isRecipeType(obj["@type"])) return obj;
  if (obj["@graph"]) return findRecipeNode(obj["@graph"]);
  return null;
}

/** Schema.org Recipe from JSON-LD, including "@type": ["Recipe", ...] and @graph. */
export function extractJsonLd(html: string): Record<string, unknown> | null {
  const $ = cheerio.load(html);
  const jsonLdScripts = $('script[type="application/ld+json"]');

  for (let i = 0; i < jsonLdScripts.length; i++) {
    const content = jsonLdScripts.eq(i).html();
    if (!content) continue;
    try {
      const recipe = findRecipeNode(JSON.parse(content));
      if (recipe) return recipe;
    } catch {
      continue;
    }
  }
  return null;
}

function sectionAfterHeading(text: string, heading: RegExp): string {
  const match = heading.exec(text);
  if (!match) return "";
  const rest = text.slice(match.index + match[0].length);
  const next = /^#{1,4}\s+/m.exec(rest);
  return next ? rest.slice(0, next.index) : rest;
}

/** Jina/nav chrome has an Ingredients heading; a real card has amounts and numbered steps. */
export function looksLikeStructuredMarkdownRecipe(text: string): boolean {
  if (!text || looksLikeBotChallenge(text)) return false;
  const ingredients = sectionAfterHeading(text, /^#{1,4}\s+ingredients?\b/im);
  const steps = sectionAfterHeading(text, /^#{1,4}\s+(instructions?|directions?)\b/im);
  if (!ingredients || !steps) return false;
  const amountLines = ingredients.split(/\r?\n/).filter((line) => {
    const item = line.replace(/^\s*(?:(?:[-*+]|\d+\.)\s+)*(?:\[[ xX]\]\s+)?/, "").trim();
    if (!item) return false;
    const parsed = parseIngredientLine(item);
    return parsed.quantityMin != null || parsed.unit != null;
  });
  const numbered = steps.split(/\r?\n/).filter((line) => /^\s*\d+\.\s+\S/.test(line));
  return amountLines.length >= 3 && numbered.length >= 1;
}

function isFallbackRecipe(html: string): boolean {
  if (extractJsonLd(html)) return true;
  if (
    /itemprop=["']recipeIngredient["']/i.test(html) ||
    /itemprop=["']recipeInstructions["']/i.test(html)
  ) {
    return true;
  }
  return looksLikeStructuredMarkdownRecipe(html);
}

export function isUsableRecipeHtml(html: string): boolean {
  if (!html) return false;
  if (looksLikeGonePage(html)) return false;
  if (/application\/ld\+json/i.test(html) && /"@type"\s*:\s*"Recipe"/i.test(html)) return true;
  if (looksLikeBotChallenge(html)) return false;
  const compact = html.replace(/\s+/g, " ").trim();
  if (compact.length < 400) return false;
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

export function looksLikeCompleteDocument(html: string): boolean {
  if (!html || html.length < 200) return false;
  if (looksLikeBotChallenge(html) || looksLikeSoftBlock(html)) {
    return false;
  }
  return /<html[\s>]|<body[\s>]|<title[\s>]/i.test(html);
}

/**
 * Keep fetching other layers when the response is a challenge, paywall, or empty.
 * Stop when we have a real page that is not a recipe (example.com).
 */
export function shouldKeepLooking(html: string, status: number): boolean {
  if (!html) return true;
  if (isUsableRecipeHtml(html)) return false;
  if (status === 404 || BLOCKED_STATUSES.has(status) || status >= 500) return true;
  if (looksLikeBotChallenge(html) || looksLikeSoftBlock(html)) {
    return true;
  }
  if (looksLikePaywall(html)) return true;
  if (looksLikeCompleteDocument(html)) return false;
  return true;
}

export {
  googleTranslateUrl,
  jinaReaderUrl,
  publicCopyRequests,
  relatedRecipeUrls,
  translateGoogUrl,
} from "./public-copies";

function cacheFallbackEnabled(env: Record<string, string | undefined>): boolean {
  return env.RECIPE_IMPORT_CACHE_FALLBACK !== "0";
}

function cacheCopyFamily(label: string): "google-translate" | "jina" {
  return label.startsWith("jina") ? "jina" : "google-translate";
}

function cacheCopyHeaders(copy: PublicCopy): Record<string, string> {
  if (copy.label.startsWith("jina")) {
    return {
      "User-Agent": CHROME_USER_AGENT,
      Accept: "text/html, text/markdown, */*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9",
      ...copy.headers,
    };
  }
  return { ...FULL_BROWSER_HEADERS, ...copy.headers };
}

function headerValue(headers: unknown, name: string): string | null {
  if (!headers || typeof headers !== "object" || typeof (headers as Headers).get !== "function") {
    return null;
  }
  return (headers as Headers).get(name);
}

function retryAfterWaitMs(header: string | null, remainingMs: number): number {
  // shortcut: cap 2.5s so Retry-After: 60 cannot eat the 60s import route
  const cap = Math.min(2_500, remainingMs);
  const fallback = Math.min(1_500, cap);
  if (!header) return fallback;
  const seconds = Number(header);
  if (Number.isFinite(seconds) && seconds >= 0) return Math.min(seconds * 1000, cap);
  const at = Date.parse(header);
  if (!Number.isNaN(at)) return Math.min(Math.max(0, at - Date.now()), cap);
  return fallback;
}

async function readResponse(
  fetchImpl: typeof fetch,
  url: string,
  extraHeaders?: Record<string, string>,
  timeoutMs = CACHE_FETCH_MS
): Promise<{
  ok: boolean;
  status: number;
  statusText: string;
  html: string;
  finalUrl: string;
  headers?: Headers;
}> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(url, {
      headers: { ...FULL_BROWSER_HEADERS, ...extraHeaders },
      redirect: "follow",
      signal: controller.signal,
    });
    const html = await response.text();
    return {
      ok: response.ok,
      status: response.status,
      statusText: response.statusText,
      html,
      finalUrl: response.url || url,
      headers: response.headers,
    };
  } finally {
    clearTimeout(timer);
  }
}

type PageHit = {
  html: string;
  finalUrl: string;
  via: FetchLayer;
  status: number;
};

/**
 * Layered recipe-page fetch:
 * 1. Direct HTTP with a full browser header set (and related live URLs on 404)
 * 2. Public copies: Google Translate and Jina (named in the blocked message)
 *
 * A live page that is not a recipe (example.com) is returned so extract can
 * say "no recipe found". If the live page itself was a challenge or block,
 * a later non-recipe copy is still blocked; only a later recipe wins.
 */
export async function fetchHtml(url: string, options: FetchHtmlOptions = {}): Promise<FetchResult> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const env = options.env ?? process.env;
  const startedAt = options.startedAt ?? Date.now();
  const sleep =
    options.sleep ?? ((ms: number) => new Promise((resolve) => setTimeout(resolve, ms)));

  const layersTried: string[] = [];
  let lastStatus = 403;
  let lastStatusText = "Forbidden";
  let directStatus: number | undefined;
  let sawDirectBlock = false;
  const state: { fallback: FetchResult | null } = { fallback: null };

  const remember = (hit: PageHit): FetchResult | null => {
    if (sawDirectBlock ? isFallbackRecipe(hit.html) : isUsableRecipeHtml(hit.html)) {
      return {
        html: hit.html,
        url,
        finalUrl: hit.finalUrl,
        via: hit.via,
        layersTried,
        directStatus,
        directBlocked: sawDirectBlock,
      };
    }
    if (
      !state.fallback &&
      hit.status >= 200 &&
      hit.status < 300 &&
      (looksLikeCompleteDocument(hit.html) ||
        looksLikePaywall(hit.html) ||
        looksLikeGonePage(hit.html)) &&
      !looksLikeBotChallenge(hit.html) &&
      !looksLikeSoftBlock(hit.html)
    ) {
      state.fallback = {
        html: hit.html,
        url,
        finalUrl: hit.finalUrl,
        via: hit.via,
        layersTried,
        directStatus,
        directBlocked: sawDirectBlock,
      };
    }
    return null;
  };

  const tryDirect = async (candidate: string, layer: FetchLayer): Promise<FetchResult | null> => {
    layersTried.push(layer);
    try {
      let direct = await readResponse(fetchImpl, candidate);
      if (layer === "direct" && (BLOCKED_STATUSES.has(direct.status) || direct.status >= 500)) {
        const wait = retryAfterWaitMs(
          headerValue(direct.headers, "retry-after"),
          remainingImportBudgetMs(startedAt)
        );
        if (wait > 0) await sleep(wait);
        direct = await readResponse(fetchImpl, candidate);
      }
      lastStatus = direct.status;
      lastStatusText = direct.statusText;
      if (layer === "direct") {
        directStatus = direct.status;
        if (
          BLOCKED_STATUSES.has(direct.status) ||
          looksLikeBotChallenge(direct.html) ||
          looksLikeSoftBlock(direct.html)
        ) {
          sawDirectBlock = true;
        }
      }
      return remember({
        html: direct.html,
        finalUrl: direct.finalUrl,
        via: layer,
        status: direct.status,
      });
    } catch {
      lastStatus = 503;
      lastStatusText = "Fetch failed";
      if (layer === "direct") directStatus = 503;
      return null;
    }
  };

  const found = await tryDirect(url, "direct");
  if (found) return found;

  for (const related of relatedRecipeUrls(url)) {
    const relatedHit = await tryDirect(related, "related");
    if (relatedHit) return relatedHit;
  }

  if (directStatus === 404) throw new RecipePageGoneError(url);

  const settledPage = state.fallback;
  const haveSettledNonRecipe =
    settledPage !== null &&
    lastStatus >= 200 &&
    lastStatus < 300 &&
    !looksLikePaywall(settledPage.html);

  if (cacheFallbackEnabled(env) && !haveSettledNonRecipe) {
    const candidates = [url, ...relatedRecipeUrls(url)];
    const copies = candidates.flatMap((candidate) => publicCopyRequests(candidate));
    const families = [...new Set(copies.map((copy) => cacheCopyFamily(copy.label)))];
    layersTried.push(...families);

    const responses = await Promise.all(
      copies.map(async (copy) => {
        try {
          return await readResponse(fetchImpl, copy.url, cacheCopyHeaders(copy));
        } catch {
          return null;
        }
      })
    );

    for (const cached of responses) {
      if (!cached) continue;
      const hit = remember({
        html: cached.html,
        finalUrl: url,
        via: "cache",
        status: cached.ok ? 200 : cached.status,
      });
      if (hit) return hit;
    }
  }

  if (state.fallback && looksLikeGonePage(state.fallback.html)) {
    throw Object.assign(new RecipePageGoneError(url), {
      directBlocked: sawDirectBlock,
      directStatus,
    });
  }
  if (state.fallback && !sawDirectBlock) return state.fallback;

  throw new RecipeImportFetchError(url, lastStatus, lastStatusText, layersTried);
}
