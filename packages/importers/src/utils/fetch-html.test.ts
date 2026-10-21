import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  FULL_BROWSER_HEADERS,
  RecipeImportFetchError,
  RecipePageGoneError,
  fetchHtml as fetchHtmlImpl,
  googleTranslateUrl,
  importBlockedMessage,
  isUsableRecipeHtml,
  looksLikeBotChallenge,
  looksLikeCompleteDocument,
  looksLikeGonePage,
  looksLikeStructuredMarkdownRecipe,
  jinaReaderUrl,
  relatedRecipeUrls,
  shouldKeepLooking,
  type FetchHtmlOptions,
} from "./fetch-html";

function fetchHtml(url: string, options: FetchHtmlOptions = {}) {
  return fetchHtmlImpl(url, { sleep: async () => {}, ...options });
}
import { createUrlImporter } from "../importers/url";
import { extractJsonLd } from "./url";

const fixtures = join(dirname(fileURLToPath(import.meta.url)), "../__tests__/fixtures/url");

function fixture(name: string): string {
  return readFileSync(join(fixtures, name), "utf8");
}

const CHALLENGE = fixture("cloudflare-challenge.html");
const VERCEL_CHECKPOINT = fixture("vercel-security-checkpoint.html");
const CF_TURNSTILE = fixture("cloudflare-turnstile.html");
const ABOUT_ALLRECIPES = fixture("about-allrecipes.html");
const ABOUT_SERIOUSEATS = fixture("about-seriouseats.html");
const ALLRECIPES_404 = fixture("allrecipes-404.html");
const RECIPETIN_404 = fixture("recipetin-404.html");
const SALLY_WIDGET = fixture("sally-recipe-with-turnstile.html");
const HBH_WIDGET = fixture("hbh-recipe-with-turnstile.html");
const FOOD52_NAV = fixture("food52-nav-chrome.html");
const FOOD52_NAV_MD = `Title: Chili Recipes

URL Source: https://food52.com/recipes/chili

Markdown Content:
Search

### [Ingredients](https://food52.com/pages/recipes)
*   [Chicken](https://food52.com/recipes/chicken)
*   [Steak](https://food52.com/recipes/steak)
*   [Salmon](https://food52.com/recipes/salmon)
*   [Pasta](https://food52.com/recipes/pasta)

### [How To & Hacks](https://food52.com/food/how-to-and-hacks)
### Method
# Beef Chili With Bacon & Black Beans

This Jina copy is Food52 site nav and a title, not a recipe card with amounts and steps.
Browse more chili recipes on Food52. The live importer saw this after a Vercel 429.
`;
const NATASHA = fixture("natashaskitchen-beef-stroganoff.html");
const BUDGET = fixture("budgetbytes-beef-stroganoff.html");
const WELLPLATED = fixture("wellplated-beef-stroganoff.html");
const EXAMPLE_COM = `<!doctype html>
<html>
<head><title>Example Domain</title></head>
<body>
<div>
    <h1>Example Domain</h1>
    <p>This domain is for use in illustrative examples in documents. You may use this domain in literature without prior coordination or asking for permission.</p>
    <p><a href="https://www.iana.org/domains/example">More information...</a></p>
</div>
</body>
</html>`;

describe("Cloudflare-protected recipe fixtures", () => {
  it("treats a Cloudflare interstitial as unusable", () => {
    expect(looksLikeBotChallenge(CHALLENGE)).toBe(true);
    expect(isUsableRecipeHtml(CHALLENGE)).toBe(false);
    expect(extractJsonLd(CHALLENGE)).toBeNull();
  });

  it.each([
    ["natashaskitchen", NATASHA, /stroganoff/i, 16, 4],
    ["budgetbytes", BUDGET, /stroganoff/i, 11, 4],
    ["wellplated", WELLPLATED, /stroganoff/i, 16, 5],
  ] as const)(
    "extracts recorded JSON-LD for %s",
    async (_name, html, title, ingredientCount, servings) => {
      expect(looksLikeBotChallenge(html)).toBe(false);
      const jsonLd = extractJsonLd(html);
      expect(jsonLd).toBeTruthy();
      expect(String(jsonLd?.name)).toMatch(title);
      expect(jsonLd?.recipeIngredient).toHaveLength(ingredientCount);

      const draft = await createUrlImporter().toDraft({
        sourceType: "url",
        sourceUrl: "https://example.com/recipe",
        rawData: jsonLd!,
        extractedAt: new Date(),
        extractorVersion: "0.1.0",
      });
      expect(draft.title).toMatch(title);
      expect(draft.ingredients.length).toBe(ingredientCount);
      expect(draft.servings).toBe(servings);
    }
  );
});

describe("page classification", () => {
  it("treats example.com as a complete non-recipe page, not a block", () => {
    expect(looksLikeCompleteDocument(EXAMPLE_COM)).toBe(true);
    expect(isUsableRecipeHtml(EXAMPLE_COM)).toBe(false);
    expect(shouldKeepLooking(EXAMPLE_COM, 200)).toBe(false);
    expect(looksLikeBotChallenge(EXAMPLE_COM)).toBe(false);
  });

  it("does not treat a Food Network 404 chrome page as a recipe", () => {
    const notFound = `<!DOCTYPE HTML><html lang="en"><head>
      <title>Page Not Found | Food Network</title>
      <script type="application/ld+json">[{"@type":"WebSite","name":"Food Network"}]</script>
      </head><body><h1>Page Not Found</h1>
      <p>The Recipe you are looking for has been moved. Browse more recipes on Food Network.</p>
      </body></html>`;
    expect(isUsableRecipeHtml(notFound)).toBe(false);
    expect(looksLikeGonePage(notFound)).toBe(true);
    expect(looksLikeBotChallenge(notFound)).toBe(false);
  });

  it("lists paste and photo in the blocked message", () => {
    expect(importBlockedMessage(["direct", "google-translate", "jina"])).toBe(
      "This site blocked the importer. Paste the recipe text or add a photo instead."
    );
  });
});

describe("fetchHtml layers", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("sends a full browser header set on the first request", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: "OK",
      url: "https://natashaskitchen.com/beef-stroganoff/",
      text: async () => NATASHA,
    });

    const result = await fetchHtml("https://natashaskitchen.com/beef-stroganoff/", {
      fetchImpl: fetchMock as unknown as typeof fetch,
      env: { RECIPE_IMPORT_CACHE_FALLBACK: "0" },
    });
    expect(result.via).toBe("direct");
    expect(result.layersTried).toEqual(["direct"]);
    expect(extractJsonLd(result.html)?.name).toMatch(/stroganoff/i);
    const headers = fetchMock.mock.calls[0]?.[1]?.headers as Record<string, string>;
    expect(headers["User-Agent"]).toMatch(/Firefox\/144/);
    expect(headers["Accept-Encoding"]).toMatch(/gzip/);
    expect(headers["Sec-Fetch-Mode"]).toBe("navigate");
    expect(headers["Accept-Language"]).toMatch(/en-US/);
    expect(headers["sec-ch-ua"]).toBeUndefined();
    expect(FULL_BROWSER_HEADERS["Sec-Fetch-Dest"]).toBe("document");
  });

  it("returns example.com HTML instead of calling it blocked", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: "OK",
      url: "https://example.com/",
      text: async () => EXAMPLE_COM,
    });

    const result = await fetchHtml("https://example.com/", {
      fetchImpl: fetchMock as unknown as typeof fetch,
      env: {},
    });
    expect(result.via).toBe("direct");
    expect(result.html).toMatch(/Example Domain/);
    expect(isUsableRecipeHtml(result.html)).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("retries a flaky 403 on the direct layer once", async () => {
    const waits: number[] = [];
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 403,
        statusText: "Forbidden",
        url: "https://www.budgetbytes.com/beef-stroganoff/",
        headers: { get: (name: string) => (name.toLowerCase() === "retry-after" ? "2" : null) },
        text: async () => CHALLENGE,
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: "OK",
        url: "https://www.budgetbytes.com/beef-stroganoff/",
        text: async () => BUDGET,
      });

    const result = await fetchHtml("https://www.budgetbytes.com/beef-stroganoff/", {
      fetchImpl: fetchMock as unknown as typeof fetch,
      env: { RECIPE_IMPORT_CACHE_FALLBACK: "0" },
      sleep: async (ms) => {
        waits.push(ms);
      },
    });
    expect(result.via).toBe("direct");
    expect(result.layersTried).toEqual(["direct"]);
    expect(extractJsonLd(result.html)?.name).toMatch(/stroganoff/i);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(waits).toEqual([2000]);
  });

  it("caps Retry-After to the remaining URL budget", async () => {
    const waits: number[] = [];
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 429,
        statusText: "Too Many Requests",
        url: "https://www.budgetbytes.com/beef-stroganoff/",
        headers: { get: (name: string) => (name.toLowerCase() === "retry-after" ? "30" : null) },
        text: async () => CHALLENGE,
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: "OK",
        url: "https://www.budgetbytes.com/beef-stroganoff/",
        text: async () => BUDGET,
      });

    await fetchHtml("https://www.budgetbytes.com/beef-stroganoff/", {
      fetchImpl: fetchMock as unknown as typeof fetch,
      env: { RECIPE_IMPORT_CACHE_FALLBACK: "0" },
      startedAt: Date.now() - 49_000,
      sleep: async (ms) => {
        waits.push(ms);
      },
    });
    expect(waits[0]).toBeGreaterThan(900);
    expect(waits[0]).toBeLessThanOrEqual(1_000);
  });

  it("caps a 60s Retry-After at 2.5s so the import route does not 504", async () => {
    const waits: number[] = [];
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 429,
        statusText: "Too Many Requests",
        url: "https://www.budgetbytes.com/beef-stroganoff/",
        headers: { get: (name: string) => (name.toLowerCase() === "retry-after" ? "60" : null) },
        text: async () => CHALLENGE,
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: "OK",
        url: "https://www.budgetbytes.com/beef-stroganoff/",
        text: async () => BUDGET,
      });

    await fetchHtml("https://www.budgetbytes.com/beef-stroganoff/", {
      fetchImpl: fetchMock as unknown as typeof fetch,
      env: { RECIPE_IMPORT_CACHE_FALLBACK: "0" },
      sleep: async (ms) => {
        waits.push(ms);
      },
    });
    expect(waits).toEqual([2_500]);
  });

  it("uses the Google Translate copy when the live response is a challenge", async () => {
    const live = "https://www.allrecipes.com/recipe/26317/chicken-pot-pie-ix/";
    const fetchMock = vi.fn(async (requested: string) => {
      if (requested === googleTranslateUrl(live) || requested.includes("translate.goog")) {
        return {
          ok: true,
          status: 200,
          statusText: "OK",
          url: requested,
          text: async () => NATASHA,
        };
      }
      return {
        ok: false,
        status: requested.includes("jina") ? 451 : 403,
        statusText: "Forbidden",
        url: requested,
        text: async () => CHALLENGE,
      };
    });

    const result = await fetchHtml(live, {
      fetchImpl: fetchMock as unknown as typeof fetch,
      env: {},
    });
    expect(result.via).toBe("cache");
    expect(result.layersTried).toEqual(["direct", "google-translate", "jina"]);
    expect(extractJsonLd(result.html)?.name).toMatch(/stroganoff/i);
  });

  it("uses the Jina HTML copy when Google Translate is blocked", async () => {
    const live = "https://natashaskitchen.com/beef-stroganoff/";
    const fetchMock = vi.fn(async (requested: string) => {
      if (requested === live || requested.includes("translate.")) {
        return {
          ok: false,
          status: 403,
          statusText: "Forbidden",
          url: requested,
          text: async () => CHALLENGE,
        };
      }
      expect(requested).toBe(jinaReaderUrl(live));
      return {
        ok: true,
        status: 200,
        statusText: "OK",
        url: requested,
        text: async () => NATASHA,
      };
    });

    const result = await fetchHtml(live, {
      fetchImpl: fetchMock as unknown as typeof fetch,
      env: {},
    });
    expect(result.via).toBe("cache");
    expect(extractJsonLd(result.html)?.name).toMatch(/stroganoff/i);
  });

  it("tries Cookbook:Pancake when Cookbook:Pancakes is a 404", async () => {
    const missing = "https://en.wikibooks.org/wiki/Cookbook:Pancakes";
    const live = relatedRecipeUrls(missing)[0];
    expect(live).toBe("https://en.wikibooks.org/wiki/Cookbook:Pancake");
    const html = fixture("wikibooks-pancakes.html");
    const fetchMock = vi.fn(async (requested: string) => {
      if (requested === missing) {
        return {
          ok: false,
          status: 404,
          statusText: "Not Found",
          url: requested,
          text: async () =>
            "<html><title>Cookbook:Pancakes</title><body>No such page</body></html>",
        };
      }
      if (requested === live) {
        return { ok: true, status: 200, statusText: "OK", url: live, text: async () => html };
      }
      return {
        ok: false,
        status: 403,
        statusText: "Forbidden",
        url: requested,
        text: async () => "",
      };
    });

    const result = await fetchHtml(missing, {
      fetchImpl: fetchMock as unknown as typeof fetch,
      env: { RECIPE_IMPORT_CACHE_FALLBACK: "0" },
    });
    expect(result.via).toBe("related");
    expect(result.html).toMatch(/Ingredients/);
  });

  it("follows Cookbook:Pancake to the North American recipe when the overview has no card", async () => {
    const overview = "https://en.wikibooks.org/wiki/Cookbook:Pancake";
    const recipe = "https://en.wikibooks.org/wiki/Cookbook:Pancakes_(North_American)";
    expect(relatedRecipeUrls(overview)).toEqual([recipe]);
    const html = fixture("wikibooks-pancakes.html");
    const fetchMock = vi.fn(async (requested: string) => {
      if (requested === overview) {
        return {
          ok: true,
          status: 200,
          statusText: "OK",
          url: overview,
          text: async () =>
            `<!doctype html><html><head><title>Cookbook:Pancake</title></head>
             <body><h1>Cookbook:Pancake</h1>
             <p>Pancakes are a subcategory of flatbreads. See American pancakes.</p>
             <p>This overview is a complete document with no ingredient list.</p>
             </body></html>`,
        };
      }
      if (requested === recipe) {
        return { ok: true, status: 200, statusText: "OK", url: recipe, text: async () => html };
      }
      return {
        ok: false,
        status: 403,
        statusText: "Forbidden",
        url: requested,
        text: async () => "",
      };
    });

    const result = await fetchHtml(overview, {
      fetchImpl: fetchMock as unknown as typeof fetch,
      env: { RECIPE_IMPORT_CACHE_FALLBACK: "0" },
    });
    expect(result.via).toBe("related");
    expect(result.finalUrl).toBe(recipe);
    expect(result.html).toMatch(/Ingredients/);
  });

  it("returns Wikibooks HTML that has no JSON-LD instead of calling it blocked", async () => {
    const html = fixture("wikibooks-pancakes.html");
    expect(isUsableRecipeHtml(html)).toBe(true);
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: "OK",
      url: "https://en.wikibooks.org/wiki/Cookbook:Pancakes",
      text: async () => html,
    });

    const result = await fetchHtml("https://en.wikibooks.org/wiki/Cookbook:Pancakes", {
      fetchImpl: fetchMock as unknown as typeof fetch,
      env: { RECIPE_IMPORT_CACHE_FALLBACK: "0" },
    });
    expect(result.via).toBe("direct");
    expect(result.html).toMatch(/Ingredients/);
    expect(extractJsonLd(result.html)).toBeNull();
  });

  it("throws a paste-text fallback that names every layer when they all fail", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      statusText: "Forbidden",
      url: "https://natashaskitchen.com/beef-stroganoff/",
      text: async () => CHALLENGE,
    });

    await expect(
      fetchHtml("https://natashaskitchen.com/beef-stroganoff/", {
        fetchImpl: fetchMock as unknown as typeof fetch,
        env: {},
      })
    ).rejects.toMatchObject({
      name: "RecipeImportFetchError",
      layersTried: ["direct", "google-translate", "jina"],
    });

    try {
      await fetchHtml("https://natashaskitchen.com/beef-stroganoff/", {
        fetchImpl: fetchMock as unknown as typeof fetch,
        env: {},
      });
    } catch (error) {
      expect(error).toBeInstanceOf(RecipeImportFetchError);
      expect((error as Error).message).toMatch(/blocked the importer/);
      expect((error as Error).message).toMatch(/Paste the recipe text or add a photo/);
      expect((error as Error).message).not.toMatch(/No recipe found/);
    }
  });

  it("treats a Vercel Security Checkpoint 429 as blocked and tries the next layer", async () => {
    expect(looksLikeBotChallenge(VERCEL_CHECKPOINT)).toBe(true);
    expect(looksLikeCompleteDocument(VERCEL_CHECKPOINT)).toBe(false);
    expect(shouldKeepLooking(VERCEL_CHECKPOINT, 429)).toBe(true);

    const live = "https://food52.com/recipes/chili";
    const fetchMock = vi.fn(async (requested: string) => {
      if (requested === googleTranslateUrl(live) || requested.includes("translate.goog")) {
        return {
          ok: true,
          status: 200,
          statusText: "OK",
          url: requested,
          text: async () => NATASHA,
        };
      }
      return {
        ok: false,
        status: 429,
        statusText: "Too Many Requests",
        url: requested,
        text: async () => VERCEL_CHECKPOINT,
      };
    });

    const result = await fetchHtml(live, {
      fetchImpl: fetchMock as unknown as typeof fetch,
      env: {},
    });
    expect(result.via).toBe("cache");
    expect(result.layersTried).toEqual(["direct", "google-translate", "jina"]);
    expect(extractJsonLd(result.html)?.name).toMatch(/stroganoff/i);
  });

  it("keeps a recipe page that embeds Turnstile when JSON-LD Recipe is present", async () => {
    const html = `<!DOCTYPE html><html><head>
      <title>Tomato pasta</title>
      <script src="https://challenges.cloudflare.com/turnstile/v0/api.js"></script>
      <script type="application/ld+json">{"@type":"Recipe","name":"Tomato pasta","recipeIngredient":["pasta"]}</script>
      </head><body>
      <div class="cf-turnstile" data-sitekey="example"></div>
      <p>Verify you are human to continue.</p>
      </body></html>`;
    expect(looksLikeBotChallenge(html)).toBe(true);
    expect(isUsableRecipeHtml(html)).toBe(true);
    expect(shouldKeepLooking(html, 200)).toBe(false);

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: "OK",
      url: "https://example.com/tomato-pasta",
      text: async () => html,
    });
    const result = await fetchHtml("https://example.com/tomato-pasta", {
      fetchImpl: fetchMock as unknown as typeof fetch,
      env: { RECIPE_IMPORT_CACHE_FALLBACK: "0" },
    });
    expect(result.via).toBe("direct");
    expect(extractJsonLd(result.html)?.name).toMatch(/tomato pasta/i);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("says a 200 gone page is gone instead of not a recipe", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: "OK",
      url: "https://www.foodnetwork.com/recipes/old",
      text: async () =>
        `<!DOCTYPE HTML><html lang="en"><head>
        <title>Page Not Found | Food Network</title>
        </head><body><h1>Page Not Found</h1>
        <p>The Recipe you are looking for has been moved.</p>
        </body></html>`,
    });
    await expect(
      fetchHtml("https://www.foodnetwork.com/recipes/old", {
        fetchImpl: fetchMock as unknown as typeof fetch,
        env: { RECIPE_IMPORT_CACHE_FALLBACK: "0" },
      })
    ).rejects.toMatchObject({
      name: "RecipePageGoneError",
      message: expect.stringMatching(/page is gone[\s\S]*Paste the recipe text or add a photo/),
    });
  });

  it("says a 404 is gone instead of no recipe", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      statusText: "Not Found",
      url: "https://www.foodnetwork.com/recipes/old",
      text: async () =>
        "<!doctype html><html><head><title>Not Found</title></head><body><h1>Not Found</h1><p>This recipe has been removed.</p></body></html>",
    });
    await expect(
      fetchHtml("https://www.foodnetwork.com/recipes/old", {
        fetchImpl: fetchMock as unknown as typeof fetch,
        env: { RECIPE_IMPORT_CACHE_FALLBACK: "0" },
      })
    ).rejects.toBeInstanceOf(RecipePageGoneError);
  });

  it("keeps a full-page fallback when a later layer is blocked", async () => {
    const fetchMock = vi.fn(async (requested: string) => {
      if (requested === "https://en.wikibooks.org/wiki/Cookbook:Pancakes") {
        return {
          ok: true,
          status: 200,
          statusText: "OK",
          url: requested,
          text: async () => EXAMPLE_COM,
        };
      }
      return {
        ok: false,
        status: 403,
        statusText: "Forbidden",
        url: requested,
        text: async () => CHALLENGE,
      };
    });

    const result = await fetchHtml("https://en.wikibooks.org/wiki/Cookbook:Pancakes", {
      fetchImpl: fetchMock as unknown as typeof fetch,
      env: {},
    });
    expect(result.via).toBe("direct");
    expect(result.html).toMatch(/Example Domain/);
    expect(isUsableRecipeHtml(result.html)).toBe(false);
  });

  it("throws blocked when a later layer is a non-recipe after a challenge", async () => {
    const fetchMock = vi.fn(async (requested: string) => {
      if (requested.includes("jina") || requested.includes("translate")) {
        return {
          ok: true,
          status: 200,
          statusText: "OK",
          url: requested,
          text: async () => ABOUT_ALLRECIPES,
        };
      }
      return {
        ok: false,
        status: 403,
        statusText: "Forbidden",
        url: requested,
        text: async () => CHALLENGE,
      };
    });
    await expect(
      fetchHtml("https://www.allrecipes.com/about-us-6648104", {
        fetchImpl: fetchMock as unknown as typeof fetch,
        env: {},
      })
    ).rejects.toMatchObject({
      name: "RecipeImportFetchError",
      message: expect.stringMatching(/blocked the importer/),
    });
  });

  it("throws blocked when a Cloudflare challenge is followed by a non-recipe cache page", async () => {
    const live = "https://cookieandkate.com/best-lentil-soup-recipe/";
    const fetchMock = vi.fn(async (requested: string) => {
      if (requested.includes("jina") || requested.includes("translate")) {
        return {
          ok: true,
          status: 200,
          statusText: "OK",
          url: requested,
          text: async () => EXAMPLE_COM,
        };
      }
      return {
        ok: true,
        status: 200,
        statusText: "OK",
        url: requested,
        text: async () => CHALLENGE,
      };
    });
    await expect(
      fetchHtml(live, {
        fetchImpl: fetchMock as unknown as typeof fetch,
        env: {},
      })
    ).rejects.toMatchObject({
      name: "RecipeImportFetchError",
      message: expect.stringMatching(/blocked the importer/),
    });
  });

  it("throws blocked when a Vercel 429 is followed by Food52 nav chrome", async () => {
    expect(isUsableRecipeHtml(FOOD52_NAV)).toBe(true);
    expect(isUsableRecipeHtml(FOOD52_NAV_MD)).toBe(true);
    expect(FOOD52_NAV).not.toMatch(/"@type"\s*:\s*"Recipe"/);

    const live = "https://food52.com/recipes/chili";
    const fetchMock = vi.fn(async (requested: string) => {
      if (requested.includes("jina")) {
        return {
          ok: true,
          status: 200,
          statusText: "OK",
          url: requested,
          text: async () => FOOD52_NAV_MD,
        };
      }
      if (requested.includes("translate")) {
        return {
          ok: true,
          status: 200,
          statusText: "OK",
          url: requested,
          text: async () => FOOD52_NAV,
        };
      }
      return {
        ok: false,
        status: 429,
        statusText: "Too Many Requests",
        url: requested,
        headers: {
          get: (name: string) => (name.toLowerCase() === "x-vercel-mitigated" ? "challenge" : null),
        },
        text: async () => VERCEL_CHECKPOINT,
      };
    });

    await expect(
      fetchHtml(live, {
        fetchImpl: fetchMock as unknown as typeof fetch,
        env: {},
      })
    ).rejects.toMatchObject({
      name: "RecipeImportFetchError",
      message: expect.stringMatching(/blocked the importer/),
    });
    expect(looksLikeStructuredMarkdownRecipe(FOOD52_NAV_MD)).toBe(false);
    expect(extractJsonLd(FOOD52_NAV)).toBeNull();
  });

  it("imports a list-type JSON-LD recipe from cache after a 403", async () => {
    const html = `<!doctype html><html><head><title>List chili</title>
      <script type="application/ld+json">{"@type":["Recipe","NewsArticle"],"name":"List chili","recipeIngredient":["1 cup beans"]}</script>
      </head><body><h1>List chili</h1></body></html>`;
    expect(html).not.toMatch(/"@type"\s*:\s*"Recipe"/);
    expect(extractJsonLd(html)?.name).toMatch(/list chili/i);

    const live = "https://www.allrecipes.com/recipe/list-chili";
    const fetchMock = vi.fn(async (requested: string) => {
      if (requested.includes("translate")) {
        return { ok: true, status: 200, statusText: "OK", url: requested, text: async () => html };
      }
      return {
        ok: false,
        status: 403,
        statusText: "Forbidden",
        url: requested,
        text: async () => CHALLENGE,
      };
    });
    const result = await fetchHtml(live, {
      fetchImpl: fetchMock as unknown as typeof fetch,
      env: {},
    });
    expect(result.via).toBe("cache");
    expect(extractJsonLd(result.html)?.name).toMatch(/list chili/i);
  });

  it("imports a @graph Recipe from cache after a 403", async () => {
    const html = `<!doctype html><html><head><title>Graph chili</title>
      <script type="application/ld+json">{"@context":"https://schema.org","@graph":[{"@type":"WebSite","name":"Serious Eats"},{"@type":["Recipe"],"name":"Graph chili","recipeIngredient":["1 onion"]}]}</script>
      </head><body><h1>Graph chili</h1></body></html>`;
    expect(html).not.toMatch(/"@type"\s*:\s*"Recipe"/);
    expect(extractJsonLd(html)?.name).toMatch(/graph chili/i);

    const live = "https://www.seriouseats.com/graph-chili";
    const fetchMock = vi.fn(async (requested: string) => {
      if (requested.includes("translate")) {
        return { ok: true, status: 200, statusText: "OK", url: requested, text: async () => html };
      }
      return {
        ok: false,
        status: 403,
        statusText: "Forbidden",
        url: requested,
        text: async () => CHALLENGE,
      };
    });
    const result = await fetchHtml(live, {
      fetchImpl: fetchMock as unknown as typeof fetch,
      env: {},
    });
    expect(result.via).toBe("cache");
    expect(extractJsonLd(result.html)?.name).toMatch(/graph chili/i);
  });

  it("imports a structured Jina markdown recipe after a 403", async () => {
    const markdown = `# Best Lentil Soup

## Ingredients
- 2 cups green lentils
- 1 onion, diced
- 2 tbsp olive oil
- 4 cups vegetable broth

## Instructions
1. Warm the oil and cook the onion.
2. Add lentils and broth and simmer until tender.
`;
    expect(looksLikeStructuredMarkdownRecipe(markdown)).toBe(true);
    expect(looksLikeStructuredMarkdownRecipe(FOOD52_NAV_MD)).toBe(false);

    const live = "https://cookieandkate.com/best-lentil-soup-recipe/";
    const fetchMock = vi.fn(async (requested: string) => {
      if (requested.includes("jina")) {
        return {
          ok: true,
          status: 200,
          statusText: "OK",
          url: requested,
          text: async () => markdown,
        };
      }
      return {
        ok: false,
        status: 403,
        statusText: "Forbidden",
        url: requested,
        text: async () => CHALLENGE,
      };
    });
    const result = await fetchHtml(live, {
      fetchImpl: fetchMock as unknown as typeof fetch,
      env: {},
    });
    expect(result.via).toBe("cache");
    expect(result.html).toMatch(/2 cups green lentils/);
  });

  it("imports Jina markdown whose ingredients use stacked task-checkbox bullets", async () => {
    const markdown = `# Best Lentil Soup

## Ingredients
* - [x] ¼ cup extra virgin olive oil
* - [x] 1 medium yellow onion
* - [x] 2 carrots, peeled and chopped
* - [x] 4 cups vegetable broth

## Instructions
1. Warm the oil and cook the onion.
2. Add lentils and broth and simmer until tender.
`;
    expect(looksLikeStructuredMarkdownRecipe(markdown)).toBe(true);
    expect(looksLikeStructuredMarkdownRecipe(FOOD52_NAV_MD)).toBe(false);

    const live = "https://cookieandkate.com/best-lentil-soup-recipe/";
    const fetchMock = vi.fn(async (requested: string) => {
      if (requested.includes("jina")) {
        return {
          ok: true,
          status: 200,
          statusText: "OK",
          url: requested,
          text: async () => markdown,
        };
      }
      return {
        ok: false,
        status: 403,
        statusText: "Forbidden",
        url: requested,
        text: async () => CHALLENGE,
      };
    });
    const result = await fetchHtml(live, {
      fetchImpl: fetchMock as unknown as typeof fetch,
      env: {},
    });
    expect(result.via).toBe("cache");
    expect(result.html).toMatch(/¼ cup extra virgin olive oil/);
  });

  it("throws blocked, not no-recipe, when every layer is a checkpoint", async () => {
    expect(looksLikeBotChallenge(CF_TURNSTILE)).toBe(true);

    const fetchMock = vi.fn(async (requested: string) => {
      if (requested.includes("jina") || requested.includes("translate")) {
        return {
          ok: false,
          status: 403,
          statusText: "Forbidden",
          url: requested,
          text: async () => CF_TURNSTILE,
        };
      }
      return {
        ok: false,
        status: 429,
        statusText: "Too Many Requests",
        url: requested,
        text: async () => VERCEL_CHECKPOINT,
      };
    });

    await expect(
      fetchHtml("https://sallysbakingaddiction.com/cookies/", {
        fetchImpl: fetchMock as unknown as typeof fetch,
        env: {},
      })
    ).rejects.toMatchObject({
      name: "RecipeImportFetchError",
      message: expect.stringMatching(/blocked the importer/),
    });
  });
});

describe("import failure reasons", () => {
  it("does not treat a Turnstile widget on an About page as a block", () => {
    expect(looksLikeBotChallenge(ABOUT_ALLRECIPES)).toBe(false);
    expect(looksLikeBotChallenge(ABOUT_SERIOUSEATS)).toBe(false);
    expect(looksLikeGonePage(ABOUT_ALLRECIPES)).toBe(false);
    expect(isUsableRecipeHtml(ABOUT_ALLRECIPES)).toBe(false);
  });

  it("treats 404 chrome with a Recipe ad slot as gone, not a recipe", () => {
    expect(ALLRECIPES_404).toMatch(/"Recipe"/);
    expect(RECIPETIN_404).toMatch(/"Recipe"/);
    expect(looksLikeGonePage(ALLRECIPES_404)).toBe(true);
    expect(looksLikeGonePage(RECIPETIN_404)).toBe(true);
    expect(isUsableRecipeHtml(ALLRECIPES_404)).toBe(false);
    expect(isUsableRecipeHtml(RECIPETIN_404)).toBe(false);
  });

  it("still treats a real interstitial as a challenge", () => {
    expect(looksLikeBotChallenge(CHALLENGE)).toBe(true);
    expect(looksLikeBotChallenge(VERCEL_CHECKPOINT)).toBe(true);
    expect(looksLikeBotChallenge(CF_TURNSTILE)).toBe(true);
  });

  it("imports Sally and HBH recipe pages that include a Turnstile widget", () => {
    expect(looksLikeBotChallenge(SALLY_WIDGET)).toBe(false);
    expect(looksLikeBotChallenge(HBH_WIDGET)).toBe(false);
    expect(isUsableRecipeHtml(SALLY_WIDGET)).toBe(true);
    expect(isUsableRecipeHtml(HBH_WIDGET)).toBe(true);
    expect(extractJsonLd(SALLY_WIDGET)?.name).toMatch(/chewy chocolate chip/i);
    expect(extractJsonLd(HBH_WIDGET)?.name).toMatch(/giant chocolate chip/i);
  });

  it("says an HTTP 404 is gone even if cache HTML quotes Recipe", async () => {
    const fetchMock = vi.fn(async (requested: string) => {
      if (requested.includes("jina") || requested.includes("translate")) {
        return {
          ok: true,
          status: 200,
          statusText: "OK",
          url: requested,
          text: async () => RECIPETIN_404,
        };
      }
      return {
        ok: false,
        status: 404,
        statusText: "Not Found",
        url: requested,
        text: async () => RECIPETIN_404,
      };
    });
    await expect(
      fetchHtml("https://www.recipetineats.com/missing/", {
        fetchImpl: fetchMock as unknown as typeof fetch,
        env: {},
      })
    ).rejects.toBeInstanceOf(RecipePageGoneError);
  });
});

describe("url importer extract messages", () => {
  it("says no recipe found for example.com", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: "OK",
      url: "https://example.com/",
      text: async () => EXAMPLE_COM,
    });
    vi.stubGlobal("fetch", fetchMock);

    try {
      await expect(
        createUrlImporter().extract({ url: "https://example.com/" })
      ).rejects.toMatchObject({
        name: "RecipeNotFoundError",
        message: expect.stringMatching(/couldn't find a recipe/),
      });
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
