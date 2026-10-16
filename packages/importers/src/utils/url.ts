/* eslint-disable no-undef */
import * as cheerio from "cheerio";

export {
  CHROME_USER_AGENT,
  FULL_BROWSER_HEADERS,
  RecipeImportFetchError,
  RecipeNotFoundError,
  fetchHtml,
  formatLayersTried,
  getRecipePageRenderer,
  importBlockedMessage,
  installRecipePageRenderer,
  isUsableRecipeHtml,
  looksLikeBotChallenge,
  looksLikeCompleteDocument,
  looksLikePaywall,
  looksLikeSoftBlock,
  looksLikeWaybackShell,
  shouldKeepLooking,
  shouldRetryFetchWithBrowserHeaders,
  waybackMachineUrl,
  waybackIdentityUrl,
  jinaReaderUrl,
  googleTranslateUrl,
  translateGoogUrl,
  relatedRecipeUrls,
  publicCopyRequests,
  type FetchHtmlOptions,
  type FetchLayer,
  type FetchResult,
  type RecipePageRenderer,
} from "./fetch-html";
export { extractHtmlRecipe, htmlLooksLikeRecipe } from "./html-recipe";
export { resolveScrapeService, scrapeRemotePage } from "./scrape-service";

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

/**
 * Extract JSON-LD schema.org Recipe data from HTML
 */
export function extractJsonLd(html: string): Record<string, unknown> | null {
  const $ = cheerio.load(html);

  const jsonLdScripts = $('script[type="application/ld+json"]');

  for (let i = 0; i < jsonLdScripts.length; i++) {
    const script = jsonLdScripts.eq(i);
    const content = script.html();
    if (!content) continue;

    try {
      const data = JSON.parse(content);

      const recipe = findRecipeNode(data);
      if (recipe) return recipe;
    } catch {
      continue;
    }
  }

  return null;
}

/**
 * Normalize a schema.org time duration to minutes
 * Handles ISO 8601 durations like "PT1H30M", "PT45M", "P1DT2H"
 */
export function parseDuration(duration: unknown): number | undefined {
  if (duration == null) return undefined;
  if (typeof duration === "number" && Number.isFinite(duration)) {
    return Math.max(0, Math.round(duration));
  }
  if (typeof duration !== "string") return undefined;

  const iso = duration
    .trim()
    .match(/^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?)?$/i);
  if (iso) {
    const days = iso[1] ? parseInt(iso[1], 10) : 0;
    const hours = iso[2] ? parseInt(iso[2], 10) : 0;
    const minutes = iso[3] ? parseInt(iso[3], 10) : 0;
    const seconds = iso[4] ? parseFloat(iso[4]) : 0;
    return days * 24 * 60 + hours * 60 + minutes + Math.round(seconds / 60);
  }

  const days = duration.match(/(\d+)\s*(?:days?|d)\b/i);
  const hours = duration.match(/(\d+)\s*(?:hours?|hrs?|h)\b/i);
  const minutes = duration.match(/(\d+)\s*(?:minutes?|mins?|m)\b/i);
  if (days || hours || minutes) {
    const total =
      (days?.[1] ? parseInt(days[1], 10) : 0) * 24 * 60 +
      (hours?.[1] ? parseInt(hours[1], 10) : 0) * 60 +
      (minutes?.[1] ? parseInt(minutes[1], 10) : 0);
    return total > 0 ? total : undefined;
  }

  return undefined;
}

/**
 * Extract author from schema.org Recipe
 */
export function extractAuthor(recipe: Record<string, unknown>): string | undefined {
  const author = recipe.author;
  if (!author) return undefined;

  if (typeof author === "string") return author;

  if (typeof author === "object" && author !== null) {
    const authorObj = author as Record<string, unknown>;
    if (typeof authorObj.name === "string") return authorObj.name;
    if (Array.isArray(authorObj) && authorObj.length > 0) {
      const first = authorObj[0];
      if (typeof first === "string") return first;
      if (typeof first === "object" && first !== null) {
        const firstObj = first as Record<string, unknown>;
        if (typeof firstObj.name === "string") return firstObj.name;
      }
    }
  }

  return undefined;
}

type SchemaImageCandidate = {
  url: string;
  area?: number;
};

function schemaImageUrl(value: unknown): string | undefined {
  if (typeof value === "string") {
    const url = value.trim();
    return url.length > 0 ? url : undefined;
  }
  if (typeof value !== "object" || value === null) return undefined;
  const img = value as Record<string, unknown>;
  for (const key of ["url", "contentUrl"] as const) {
    const candidate = img[key];
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate.trim();
    }
  }
  return undefined;
}

function schemaImageArea(value: unknown): number | undefined {
  if (typeof value !== "object" || value === null) return undefined;
  const img = value as Record<string, unknown>;
  const width = Number(img.width);
  const height = Number(img.height);
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return undefined;
  }
  return width * height;
}

function schemaRecipeImageCandidates(recipe: Record<string, unknown>): SchemaImageCandidate[] {
  const image = recipe.image;
  if (!image) return [];

  const values = Array.isArray(image) ? image : [image];
  const candidates: SchemaImageCandidate[] = [];
  for (const value of values) {
    const url = schemaImageUrl(value);
    if (!url) continue;
    candidates.push({ url, area: schemaImageArea(value) });
  }
  return candidates;
}

/**
 * Extract image URLs from schema.org Recipe
 */
export function extractImages(recipe: Record<string, unknown>): string[] {
  return schemaRecipeImageCandidates(recipe).map((candidate) => candidate.url);
}

/**
 * One hero image for URL import: largest schema.org Recipe image (or the first
 * if sizes are missing), then the first Open Graph / page fallback.
 */
export function pickImportRecipeImage(
  recipe: Record<string, unknown>,
  pageImages?: string[]
): string | undefined {
  const schema = schemaRecipeImageCandidates(recipe);
  if (schema.length > 0) {
    const measured = schema.filter((candidate) => candidate.area != null);
    if (measured[0]) {
      return measured.reduce((best, current) =>
        (current.area ?? 0) > (best.area ?? 0) ? current : best
      ).url;
    }
    return schema[0]?.url;
  }

  const fallback = pageImages?.find((url) => url.trim().length > 0);
  return fallback?.trim();
}

/**
 * Fall back to Open Graph / Twitter images when schema.org Recipe has none.
 */
export function extractPageImages(html: string): string[] {
  const $ = cheerio.load(html);
  const images: string[] = [];
  const candidates = [
    $('meta[property="og:image"]').attr("content"),
    $('meta[property="og:image:url"]').attr("content"),
    $('meta[name="og:image"]').attr("content"),
    $('meta[name="twitter:image"]').attr("content"),
    $('meta[property="twitter:image"]').attr("content"),
  ];

  for (const candidate of candidates) {
    if (candidate && candidate.trim() && !images.includes(candidate.trim())) {
      images.push(candidate.trim());
    }
  }

  return images;
}
