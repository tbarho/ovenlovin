/* eslint-disable no-undef */
import * as cheerio from "cheerio";
import { cleanImportedTitle } from "@ovenlovin/core";
import { cleanImportedIngredientLine } from "./recipe-ld";

const INGREDIENT_HEADING = /\b(ingredients?|you will need|what you need)\b/i;
const STEP_HEADING =
  /\b(procedure|method|directions?|instructions?|steps?|preparation|how to (make|cook))\b/i;
const RECIPE_BOX = /[\u25A0-\u25A3\u25FB-\u25FE\u2610-\u2612]/;
const MARKDOWN_INGREDIENT =
  /^\s*(?:[-*]|\d+\.)\s+(?:[\u25A0-\u25A3\u25FB-\u25FE\u2610-\u2612])?\s*(.+)$/;

function headingText($el: ReturnType<cheerio.CheerioAPI>): string {
  return $el.text().replace(/\s+/g, " ").trim();
}

function listFromNode($: cheerio.CheerioAPI, start: ReturnType<cheerio.CheerioAPI>): string[] {
  const items: string[] = [];
  let node = start;
  for (let i = 0; i < 12 && node.length > 0; i++) {
    const tag = node.prop("tagName")?.toLowerCase() ?? "";
    if (/^h[1-6]$/.test(tag)) break;
    if (tag === "ul" || tag === "ol") {
      node.find("li").each((_, li) => {
        const text = $(li).text().replace(/\s+/g, " ").trim();
        if (text) items.push(text);
      });
      if (items.length > 0) return items;
    }
    const nested = node.find("ul, ol").first();
    if (nested.length > 0) {
      nested.find("li").each((_, li) => {
        const text = $(li).text().replace(/\s+/g, " ").trim();
        if (text) items.push(text);
      });
      if (items.length > 0) return items;
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

function listItemsAfter($: cheerio.CheerioAPI, heading: ReturnType<cheerio.CheerioAPI>): string[] {
  const direct = listFromNode($, heading.next());
  if (direct.length > 0) return direct;
  return listFromNode($, heading.parent().next());
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

function markdownToRoughHtml(text: string): string {
  if (/<(h1|h2|h3|ul|ol|li|script)\b/i.test(text)) return text;
  const lines = text.split(/\r?\n/);
  const out: string[] = [];
  let list: string[] = [];
  const flush = () => {
    if (list.length === 0) return;
    out.push(`<ul>${list.join("")}</ul>`);
    list = [];
  };
  for (const line of lines) {
    const heading = line.match(/^#{1,4}\s+(.+)$/);
    if (heading) {
      flush();
      out.push(`<h2>${heading[1]}</h2>`);
      continue;
    }
    const item = line.match(MARKDOWN_INGREDIENT);
    if (item?.[1]) {
      list.push(`<li>${item[1].replace(/\s*\(\$[\d.]+.*$/, "").trim()}</li>`);
      continue;
    }
    flush();
    if (line.trim()) out.push(`<p>${line.trim()}</p>`);
  }
  flush();
  return out.join("\n");
}

function extractCardMarkdown(text: string): Record<string, unknown> | null {
  const lines = text.split(/\r?\n/);
  const ingredients: string[] = [];
  const steps: string[] = [];
  for (const line of lines) {
    const boxed = line.match(/^\s*[-*]\s+[\u25A0-\u25A3\u25FB-\u25FE\u2610-\u2612]\s+(.+)$/);
    if (boxed?.[1]) {
      ingredients.push(
        boxed[1]
          .replace(/\s*\(\$[\d.]+.*$/, "")
          .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
          .trim()
      );
      continue;
    }
    if (ingredients.length >= 2 && /^\s*[-*]\s+[A-Z]/.test(line) && !RECIPE_BOX.test(line)) {
      const step = line.replace(/^\s*[-*]\s+/, "").trim();
      if (step.length > 20) steps.push(step);
    }
  }
  if (ingredients.length < 2 || steps.length < 1) return null;
  const title =
    text.match(/^Title:\s+(.+)$/m)?.[1]?.trim() || text.match(/^#\s+(.+)$/m)?.[1]?.trim() || "";
  if (!title) return null;
  return {
    "@type": "Recipe",
    name: cleanImportedTitle(title.replace(/\s+[-|].*$/, "").trim()) || title.trim(),
    recipeIngredient: ingredients,
    recipeInstructions: steps.map((step) => ({ "@type": "HowToStep", text: step })),
  };
}

export function parseHtmlRecipeServings(html: string): number | undefined {
  const $ = cheerio.load(html);
  const wprm = $(".wprm-recipe-servings").first();
  const raw = wprm.attr("value") || wprm.text() || $('[itemprop="recipeYield"]').first().text();
  const match = raw
    .replace(/\s+/g, " ")
    .trim()
    .match(/(\d+(?:\.\d+)?)/);
  if (!match?.[1]) return undefined;
  const n = Number(match[1]);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : undefined;
}

function extractWprmRecipe(html: string): Record<string, unknown> | null {
  const $ = cheerio.load(html);
  const card = $(".wprm-recipe-container, .wprm-recipe").first();
  if (!card.length) return null;

  const ingredients: string[] = [];
  card.find(".wprm-recipe-ingredient").each((_, el) => {
    const $el = $(el);
    const amount = $el.find(".wprm-recipe-ingredient-amount").text().trim();
    const unit = $el.find(".wprm-recipe-ingredient-unit").text().trim();
    const name = $el.find(".wprm-recipe-ingredient-name").text().trim();
    const notes = $el.find(".wprm-recipe-ingredient-notes").text().trim();
    const core = [amount, unit, name].filter(Boolean).join(" ");
    const line = notes ? `${core} (${notes})` : core || $el.text().replace(/\s+/g, " ").trim();
    if (line) ingredients.push(cleanImportedIngredientLine(line));
  });

  const steps: string[] = [];
  card.find(".wprm-recipe-instruction-text").each((_, el) => {
    const text = $(el).text().replace(/\s+/g, " ").trim();
    if (text) steps.push(text);
  });

  if (ingredients.length < 2 || steps.length < 1) return null;
  const title =
    card.find(".wprm-recipe-name").first().text().replace(/\s+/g, " ").trim() ||
    $("h1").first().text().replace(/\s+/g, " ").trim();
  const servings = parseHtmlRecipeServings(html);
  return {
    "@type": "Recipe",
    name: cleanImportedTitle(title) || title,
    recipeIngredient: ingredients,
    recipeInstructions: steps.map((text) => ({ "@type": "HowToStep", text })),
    ...(servings != null ? { recipeYield: servings } : {}),
  };
}

/**
 * Best-effort recipe from HTML that has no schema.org Recipe JSON-LD
 * (Wikibooks cookbooks, older blogs, public cache copies).
 */
export function extractHtmlRecipe(html: string): Record<string, unknown> | null {
  const wprm = extractWprmRecipe(html);
  if (wprm) return wprm;

  const card = /<(h1|h2|h3|ul|ol|li|script)\b/i.test(html) ? null : extractCardMarkdown(html);
  if (card) return card;

  const $ = cheerio.load(markdownToRoughHtml(html));
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

  if (title && ingredients.length >= 2 && steps.length >= 1) {
    return {
      "@type": "Recipe",
      name: cleanImportedTitle(title) || title,
      recipeIngredient: ingredients,
      recipeInstructions: steps.map((text) => ({ "@type": "HowToStep", text })),
    };
  }

  return card;
}

export function htmlLooksLikeRecipe(html: string): boolean {
  if (!html) return false;
  const compact = html.replace(/\s+/g, " ");
  if (compact.length < 400) return false;
  return (
    /application\/ld\+json/i.test(html) ||
    /itemprop=["']recipe/i.test(html) ||
    /<(h1|h2|h3|h4)[^>]*>[\s\S]{0,240}(ingredient|procedure|instruction|direction|method)/i.test(
      html
    ) ||
    /["']Recipe["']/.test(html)
  );
}
