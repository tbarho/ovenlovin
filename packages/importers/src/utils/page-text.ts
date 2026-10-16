import * as cheerio from "cheerio";

const MAX_PAGE_TEXT = 12_000;

/**
 * Cheap visible text for LLM recipe extract: drop chrome, keep title,
 * headings, lists, and article copy.
 */
export function pageTextFromHtml(html: string, maxChars = MAX_PAGE_TEXT): string {
  const $ = cheerio.load(html);
  $("script, style, noscript, iframe, svg, nav, footer, header, form").remove();

  const parts: string[] = [];
  const title = $("title").first().text().replace(/\s+/g, " ").trim();
  const h1 = $("h1").first().text().replace(/\s+/g, " ").trim();
  if (title) parts.push(title);
  if (h1 && h1 !== title) parts.push(h1);

  $("h2, h3, li, p").each((_, el) => {
    const text = $(el).text().replace(/\s+/g, " ").trim();
    if (text.length >= 2) parts.push(text);
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
