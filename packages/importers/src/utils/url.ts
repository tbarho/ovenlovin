/* eslint-disable no-undef */
import * as cheerio from "cheerio";

export interface FetchResult {
  html: string;
  url: string;
  finalUrl: string;
}

/**
 * Fetch HTML from a URL
 */
export async function fetchHtml(url: string): Promise<FetchResult> {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "OvenLovin Recipe Importer/0.1 (https://github.com/tbarho/ovenlovin)",
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    },
    redirect: "follow",
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
  }

  const html = await response.text();

  return {
    html,
    url,
    finalUrl: response.url,
  };
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

      if (Array.isArray(data)) {
        const recipe = data.find((item) => item["@type"] === "Recipe");
        if (recipe) return recipe;
      } else if (data["@type"] === "Recipe") {
        return data;
      } else if (data["@graph"]) {
        const recipe = data["@graph"].find(
          (item: { "@type"?: string }) => item["@type"] === "Recipe"
        );
        if (recipe) return recipe;
      }
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
export function parseDuration(duration: string): number | undefined {
  if (!duration || typeof duration !== "string") return undefined;

  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?/);
  if (!match) return undefined;

  const hours = match[1] ? parseInt(match[1]) : 0;
  const minutes = match[2] ? parseInt(match[2]) : 0;

  return hours * 60 + minutes;
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

/**
 * Extract image URLs from schema.org Recipe
 */
export function extractImages(recipe: Record<string, unknown>): string[] {
  const image = recipe.image;
  if (!image) return [];

  const images: string[] = [];

  if (typeof image === "string") {
    images.push(image);
  } else if (Array.isArray(image)) {
    for (const img of image) {
      if (typeof img === "string") {
        images.push(img);
      } else if (typeof img === "object" && img !== null) {
        const imgObj = img as Record<string, unknown>;
        if (typeof imgObj.url === "string") {
          images.push(imgObj.url);
        }
      }
    }
  } else if (typeof image === "object" && image !== null) {
    const imgObj = image as Record<string, unknown>;
    if (typeof imgObj.url === "string") {
      images.push(imgObj.url);
    }
  }

  return images;
}
