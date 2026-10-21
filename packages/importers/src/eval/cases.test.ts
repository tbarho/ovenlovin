import { existsSync, statSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { PHOTO_CASES, PASTE_CASES, URL_CASES, resolveEvalModels } from "./cases";

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

  it("honors EVAL_IMPORT_MODEL", () => {
    expect(resolveEvalModels({ EVAL_IMPORT_MODEL: "openai/gpt-6-luna" })).toEqual([
      "openai/gpt-6-luna",
    ]);
  });
});
