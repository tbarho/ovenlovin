import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { createUrlImporter } from "../importers/url";
import { extractHtmlRecipe } from "../utils/html-recipe";
import { extractJsonLd } from "../utils/url";
import recordedResults from "./fixtures/url/sites-results.json";
import { RECORDED_URL_SITES } from "./url-sites";

const fixtures = join(dirname(fileURLToPath(import.meta.url)), "fixtures/url");

type RecordedResult = {
  id: string;
  host: string;
  url: string;
  extractor: string;
  title: string;
  ingredientCount: number;
  stepCount: number;
  status: "ok";
};

function loadSite(name: string): string {
  return readFileSync(join(fixtures, name), "utf8");
}

function extractRecorded(html: string): {
  extractor: "json-ld" | "html";
  recipe: Record<string, unknown>;
} | null {
  const jsonLd = extractJsonLd(html);
  if (jsonLd) return { extractor: "json-ld", recipe: jsonLd };
  const htmlRecipe = extractHtmlRecipe(html);
  if (htmlRecipe) return { extractor: "html", recipe: htmlRecipe };
  return null;
}

describe("recorded popular recipe sites", () => {
  it("covers at least 10 sites including the reported hosts", () => {
    expect(RECORDED_URL_SITES.length).toBeGreaterThanOrEqual(10);
    const hosts = RECORDED_URL_SITES.map((site) => site.host);
    expect(hosts).toEqual(
      expect.arrayContaining([
        "allrecipes.com",
        "simplyrecipes.com",
        "budgetbytes.com",
        "seriouseats.com",
        "natashaskitchen.com",
        "foodnetwork.com",
        "bonappetit.com",
        "cooking.nytimes.com",
        "en.wikibooks.org",
      ])
    );
  });

  it.each(RECORDED_URL_SITES)(
    "extracts $id from the recorded snapshot ($extractor)",
    async (site) => {
      const html = loadSite(site.fixture);
      const extracted = extractRecorded(html);
      expect(extracted).toBeTruthy();
      expect(extracted?.extractor).toBe(site.extractor);
      expect(String(extracted?.recipe.name)).toMatch(site.title);

      const ingredients = extracted?.recipe.recipeIngredient;
      const steps = extracted?.recipe.recipeInstructions;
      expect(Array.isArray(ingredients) ? ingredients.length : 0).toBeGreaterThanOrEqual(
        site.minIngredients
      );
      expect(Array.isArray(steps) ? steps.length : 0).toBeGreaterThanOrEqual(site.minSteps);

      const draft = await createUrlImporter().toDraft({
        sourceType: "url",
        sourceUrl: site.url,
        rawData: extracted!.recipe,
        extractedAt: new Date(),
        extractorVersion: "0.1.0",
      });
      expect(draft.title).toMatch(site.title);
      expect(draft.ingredients.length).toBeGreaterThanOrEqual(site.minIngredients);
      expect(draft.steps.length).toBeGreaterThanOrEqual(site.minSteps);
    }
  );

  it("matches the recorded per-site results table", () => {
    const results: RecordedResult[] = RECORDED_URL_SITES.map((site) => {
      const extracted = extractRecorded(loadSite(site.fixture));
      if (!extracted) {
        throw new Error(`No recipe in recorded fixture for ${site.id}`);
      }
      const ingredients = extracted.recipe.recipeIngredient;
      const steps = extracted.recipe.recipeInstructions;
      return {
        id: site.id,
        host: site.host,
        url: site.url,
        extractor: extracted.extractor,
        title: String(extracted.recipe.name ?? ""),
        ingredientCount: Array.isArray(ingredients) ? ingredients.length : 0,
        stepCount: Array.isArray(steps) ? steps.length : 0,
        status: "ok",
      };
    });

    expect(results).toEqual(recordedResults);
  });
});
