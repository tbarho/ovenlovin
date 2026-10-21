import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { extractHtmlRecipe, htmlLooksLikeRecipe, parseHtmlRecipeServings } from "./html-recipe";
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
    expect(draft.title).not.toMatch(/Cookbook:/i);
    expect(draft.ingredients.length).toBeGreaterThanOrEqual(5);
    expect(draft.steps.length).toBe(3);
  });

  it("returns null when the page is not a recipe", () => {
    expect(extractHtmlRecipe("<html><body><p>Hello</p></body></html>")).toBeNull();
  });

  it("reads Wikibooks headings wrapped in mw-heading divs", () => {
    const html = `<html><body>
      <h1>Cookbook:Pancake</h1>
      <div class="mw-heading mw-heading2"><h2 id="Ingredients"><span>Ingredients</span></h2></div>
      <ul><li>1 cup flour</li><li>1 cup milk</li><li>1 egg</li></ul>
      <div class="mw-heading mw-heading2"><h2 id="Procedure"><span>Procedure</span></h2></div>
      <ol><li>Mix the batter.</li><li>Cook on a skillet.</li></ol>
    </body></html>`;
    const recipe = extractHtmlRecipe(html);
    expect(recipe?.name).toBe("Pancake");
    expect(recipe?.recipeIngredient).toEqual(expect.arrayContaining(["1 cup flour", "1 egg"]));
    expect(recipe?.recipeInstructions).toHaveLength(2);
  });

  it("reads a WPRM card with split spans, servings, and cost notes", () => {
    const html = `<html><body>
      <div class="wprm-recipe-container">
        <h2 class="wprm-recipe-name">Beef Stroganoff</h2>
        <span class="wprm-recipe-servings">4</span>
        <li class="wprm-recipe-ingredient">
          <span class="wprm-recipe-ingredient-amount">1</span><span class="wprm-recipe-ingredient-unit">lb.</span><span class="wprm-recipe-ingredient-name">ground beef</span><span class="wprm-recipe-ingredient-notes">($2.50*)</span>
        </li>
        <li class="wprm-recipe-ingredient">
          <span class="wprm-recipe-ingredient-amount">1</span><span class="wprm-recipe-ingredient-unit">cup</span><span class="wprm-recipe-ingredient-name">sour cream</span>
        </li>
        <li class="wprm-recipe-ingredient">
          <span class="wprm-recipe-ingredient-amount">8</span><span class="wprm-recipe-ingredient-unit">oz.</span><span class="wprm-recipe-ingredient-name">mushrooms</span>
        </li>
        <div class="wprm-recipe-instruction-text">Brown the beef.</div>
        <div class="wprm-recipe-instruction-text">Stir in the sour cream.</div>
      </div>
    </body></html>`;
    const recipe = extractHtmlRecipe(html);
    expect(recipe?.name).toMatch(/stroganoff/i);
    expect(recipe?.recipeYield).toBe(4);
    expect(recipe?.recipeIngredient).toEqual([
      "1 lb. ground beef",
      "1 cup sour cream",
      "8 oz. mushrooms",
    ]);
    expect(parseHtmlRecipeServings(html)).toBe(4);
  });

  it("reads a Jina markdown recipe card", () => {
    const box = "\u25A2";
    const markdown = [
      "Title: Beef Stroganoff",
      "",
      "URL Source: https://www.budgetbytes.com/beef-stroganoff/",
      "",
      "Markdown Content:",
      "",
      "This one-pot beef stroganoff is a weeknight dinner with egg noodles.",
      "",
      `*   ${box}  2 cloves garlic($0.16)`,
      `*   ${box}  2 Tbsp butter($0.22)`,
      `*   ${box}  1/2 lb. ground beef($2.50)`,
      "",
      "*   Mince the garlic and saute it in the butter until fragrant.",
      "*   Add the ground beef and cook until browned.",
      "*   Stir in the sour cream and serve hot.",
    ].join("\n");
    const recipe = extractHtmlRecipe(markdown);
    expect(recipe?.name).toMatch(/stroganoff/i);
    expect(recipe?.recipeIngredient).toEqual(
      expect.arrayContaining(["2 cloves garlic", "2 Tbsp butter"])
    );
    expect((recipe?.recipeInstructions as unknown[]).length).toBeGreaterThanOrEqual(2);
  });
});
