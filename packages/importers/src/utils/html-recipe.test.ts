import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { extractHtmlRecipe, htmlLooksLikeRecipe } from "./html-recipe";
import { createUrlImporter } from "../importers/url";
import { isUsableRecipeHtml } from "./fetch-html";

const fixtures = join(dirname(fileURLToPath(import.meta.url)), "../__tests__/fixtures/url");

describe("extractHtmlRecipe", () => {
  it("reads a Wikibooks cookbook page without JSON-LD", async () => {
    const html = readFileSync(join(fixtures, "wikibooks-pancakes.html"), "utf8");
    expect(isUsableRecipeHtml(html)).toBe(true);
    expect(htmlLooksLikeRecipe(html)).toBe(true);
    const recipe = extractHtmlRecipe(html);
    expect(recipe?.name).toMatch(/pancake/i);
    expect(recipe?.recipeIngredient).toEqual(
      expect.arrayContaining(["1 cup all-purpose flour", "1 egg"])
    );
    expect(recipe?.recipeInstructions).toHaveLength(3);

    const draft = await createUrlImporter().toDraft({
      sourceType: "url",
      sourceUrl: "https://en.wikibooks.org/wiki/Cookbook:Pancakes",
      rawData: recipe!,
      extractedAt: new Date(),
      extractorVersion: "0.1.0",
    });
    expect(draft.title).toMatch(/pancake/i);
    expect(draft.ingredients.length).toBeGreaterThanOrEqual(5);
    expect(draft.steps.length).toBe(3);
  });

  it("returns null when the page is not a recipe", () => {
    expect(extractHtmlRecipe("<html><body><p>Hello</p></body></html>")).toBeNull();
  });
});
