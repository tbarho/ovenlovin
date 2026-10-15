/* eslint-disable no-undef */
import * as cheerio from "cheerio";

const INGREDIENT_HEADING = /\b(ingredients?|you will need|what you need)\b/i;
const STEP_HEADING =
  /\b(procedure|method|directions?|instructions?|steps?|preparation|how to (make|cook))\b/i;

function headingText($el: ReturnType<cheerio.CheerioAPI>): string {
  return $el.text().replace(/\s+/g, " ").trim();
}

function listItemsAfter($: cheerio.CheerioAPI, heading: ReturnType<cheerio.CheerioAPI>): string[] {
  const items: string[] = [];
  let node = heading.next();
  for (let i = 0; i < 8 && node.length > 0; i++) {
    const tag = node.prop("tagName")?.toLowerCase() ?? "";
    if (/^h[1-6]$/.test(tag)) break;
    if (tag === "ul" || tag === "ol") {
      node.find("li").each((_, li) => {
        const text = $(li).text().replace(/\s+/g, " ").trim();
        if (text) items.push(text);
      });
      if (items.length > 0) break;
    }
    if (tag === "p") {
      const text = node.text().replace(/\s+/g, " ").trim();
      if (text && !INGREDIENT_HEADING.test(text) && !STEP_HEADING.test(text)) {
        items.push(text);
      }
    }
    node = node.next();
  }
  return items;
}

function firstHeading(
  $: cheerio.CheerioAPI,
  pattern: RegExp
): ReturnType<cheerio.CheerioAPI> | null {
  const headings = $("h1, h2, h3, h4");
  for (let i = 0; i < headings.length; i++) {
    const el = headings.eq(i);
    if (pattern.test(headingText(el))) return el;
  }
  return null;
}

/**
 * Best-effort recipe from HTML that has no schema.org Recipe JSON-LD
 * (Wikibooks cookbooks, older blogs, public cache copies).
 */
export function extractHtmlRecipe(html: string): Record<string, unknown> | null {
  const $ = cheerio.load(html);
  $("script, style, noscript, iframe").remove();

  const title =
    $("h1").first().text().replace(/\s+/g, " ").trim() ||
    $("title")
      .first()
      .text()
      .replace(/\s+/g, " ")
      .replace(/\s*[-|\u2014].*$/, "")
      .trim();

  const ingredientHeading = firstHeading($, INGREDIENT_HEADING);
  const stepHeading = firstHeading($, STEP_HEADING);
  const ingredients = ingredientHeading ? listItemsAfter($, ingredientHeading) : [];
  const steps = stepHeading ? listItemsAfter($, stepHeading) : [];

  if (!title || ingredients.length < 2 || steps.length < 1) return null;

  return {
    "@type": "Recipe",
    name: title,
    recipeIngredient: ingredients,
    recipeInstructions: steps.map((text) => ({ "@type": "HowToStep", text })),
  };
}

export function htmlLooksLikeRecipe(html: string): boolean {
  if (!html) return false;
  const compact = html.replace(/\s+/g, " ");
  if (compact.length < 400) return false;
  return (
    /application\/ld\+json/i.test(html) ||
    /itemprop=["']recipe/i.test(html) ||
    /<(h1|h2|h3|h4)[^>]*>[^<]{0,80}(ingredient|procedure|instruction|direction|method)/i.test(
      html
    ) ||
    /["']Recipe["']/.test(html)
  );
}
