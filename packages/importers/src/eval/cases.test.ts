import { existsSync, statSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { pageTextFromHtml } from "../utils/page-text";
import { PHOTO_CASES, PASTE_CASES, URL_CASES, resolveEvalModels } from "./cases";
import { normalizeText } from "./score";

function pasteIngredientLines(text: string): string[] {
  const lines = text.split("\n");
  const start = lines.findIndex((line) => /^ingredients:?$/i.test(line.trim()));
  const items: string[] = [];
  for (const line of lines.slice(start + 1)) {
    if (/^instructions:?$/i.test(line.trim())) break;
    const match = line.match(/^\s*-\s+(.+)/);
    if (match?.[1]) items.push(match[1]);
  }
  return items;
}

describe("import eval fixtures", () => {
  it("keeps eight cases per job", () => {
    expect(PASTE_CASES).toHaveLength(8);
    expect(PHOTO_CASES).toHaveLength(8);
    expect(URL_CASES).toHaveLength(8);
  });

  it("uses real saved recipe HTML without JSON-LD", () => {
    for (const item of URL_CASES) {
      expect(item.html && item.html.length, item.id).toBeGreaterThan(20_000);
      expect(item.html, item.id).not.toMatch(/application\/ld\+json/i);
      expect(item.html, item.id).toMatch(/<nav\b|main menu|skip to|comment|mw-/i);
    }
  });

  it("has real JPEG photo files on disk", () => {
    for (const item of PHOTO_CASES) {
      expect(item.imagePath && existsSync(item.imagePath), item.id).toBe(true);
      expect(item.imagePath?.endsWith(".jpg"), item.id).toBe(true);
      expect(statSync(item.imagePath!).size, item.id).toBeGreaterThan(10_000);
    }
    expect(
      PHOTO_CASES.some((item) => item.id === "handwritten-ginger-snaps" && item.handwritten)
    ).toBe(true);
    expect(PHOTO_CASES.some((item) => item.id === "weeknight-chili")).toBe(true);
  });

  it("lists every paste fixture ingredient line in the answer key", () => {
    for (const item of PASTE_CASES) {
      const lines = pasteIngredientLines(item.text ?? "");
      expect(lines.length, item.id).toBeGreaterThan(0);
      expect(item.expected.ingredients, item.id).toHaveLength(lines.length);
    }
  });

  it("keeps every URL key in the fixture page text", () => {
    for (const item of URL_CASES) {
      const text = pageTextFromHtml(item.html ?? "");
      expect(text.length, item.id).toBeGreaterThan(200);
      const norm = ` ${normalizeText(text)} `;
      for (const ing of item.expected.ingredients) {
        expect(norm.includes(` ${normalizeText(ing)} `), `${item.id}:${ing}`).toBe(true);
      }
      if (item.expected.servings != null) {
        const allowed = Array.isArray(item.expected.servings)
          ? item.expected.servings
          : [item.expected.servings];
        expect(
          allowed.some((value) => text.includes(String(value))),
          `${item.id} servings ${allowed.join(",")}`
        ).toBe(true);
      }
    }
  });

  it("honors EVAL_IMPORT_MODEL", () => {
    expect(resolveEvalModels({ EVAL_IMPORT_MODEL: "openai/gpt-6-luna" })).toEqual([
      "openai/gpt-6-luna",
    ]);
  });
});
