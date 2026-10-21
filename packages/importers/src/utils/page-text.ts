import * as cheerio from "cheerio";

const MAX_PAGE_TEXT = 12_000;

function folded(value: string): string {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function alreadyIncluded(text: string, parts: string[]): boolean {
  const next = folded(text);
  if (next.length < 2) return true;
  return parts.some((part) => {
    const have = folded(part);
    return have.includes(next) || (next.length > 20 && next.includes(have));
  });
}

/** Ingredients heading followed by a list: skip tables (nutrition/layout). */
function hasIngredientList($: cheerio.CheerioAPI, hasScope: boolean): boolean {
  const scope = hasScope
    ? $("main, article, #mw-content-text, .hentry, .recipe").first()
    : $("body");
  let found = false;
  scope.find("h2, h3").each((_, el) => {
    if (!/ingredient/i.test($(el).text())) return;
    let node = $(el).next();
    while (node.length && !node.is("h2, h3")) {
      if (node.is("ul, ol") && node.find("li").length >= 2) found = true;
      if (node.find("ul li, ol li").length >= 2) found = true;
      node = node.next();
    }
  });
  return found;
}

/**
 * Cheap visible text for LLM recipe extract: drop chrome, keep title,
 * headings, lists, and article copy. Tables only when the page has no
 * ingredient list (Wikibooks banana bread).
 */
export function pageTextFromHtml(html: string, maxChars = MAX_PAGE_TEXT): string {
  const $ = cheerio.load(html);
  $("script, style, noscript, iframe, svg, nav, footer, header, form").remove();

  const parts: string[] = [];
  const title = $("title").first().text().replace(/\s+/g, " ").trim();
  const h1 = $("h1").first().text().replace(/\s+/g, " ").trim();
  if (title) parts.push(title);
  if (h1 && h1 !== title) parts.push(h1);

  const scoped = $("main, article, #mw-content-text, .hentry, .recipe").first();
  const root = scoped.length > 0 ? scoped : $("body");
  const skipTables = hasIngredientList($, scoped.length > 0);
  const nodes = root.find(skipTables ? "h2, h3, li, p" : "h2, h3, li, p, tr");
  nodes.each((_, el) => {
    const text = $(el).text().replace(/\s+/g, " ").trim();
    if (text.length < 2) return;
    if ($(el).is("tr") && alreadyIncluded(text, parts)) return;
    parts.push(text);
  });

  const unique: string[] = [];
  const seen = new Set<string>();
  for (const part of parts) {
    const key = part.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(part);
  }

  return unique.join("\n").slice(0, maxChars).trim();
}
