import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  FULL_BROWSER_HEADERS,
  RecipeImportFetchError,
  fetchHtml,
  googleTranslateUrl,
  isUsableRecipeHtml,
  looksLikeBotChallenge,
  looksLikeWaybackShell,
  jinaReaderUrl,
  relatedRecipeUrls,
  waybackIdentityUrl,
  waybackMachineUrl,
} from "./fetch-html";
import { createUrlImporter } from "../importers/url";
import { extractJsonLd } from "./url";

const fixtures = join(dirname(fileURLToPath(import.meta.url)), "../__tests__/fixtures/url");

function fixture(name: string): string {
  return readFileSync(join(fixtures, name), "utf8");
}

const CHALLENGE = fixture("cloudflare-challenge.html");
const NATASHA = fixture("natashaskitchen-beef-stroganoff.html");
const BUDGET = fixture("budgetbytes-beef-stroganoff.html");
const WELLPLATED = fixture("wellplated-beef-stroganoff.html");

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
    expect(extractJsonLd(result.html)?.name).toMatch(/stroganoff/i);
    const headers = fetchMock.mock.calls[0]?.[1]?.headers as Record<string, string>;
    expect(headers["User-Agent"]).toMatch(/Mozilla\/5.0/);
    expect(headers["sec-ch-ua"]).toMatch(/Chromium/);
    expect(headers["sec-fetch-mode"]).toBe("navigate");
    expect(headers["Accept-Language"]).toMatch(/en-US/);
    expect(FULL_BROWSER_HEADERS["sec-fetch-dest"]).toBe("document");
  });

  it("renders in headless Chromium when the live response is a challenge", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      statusText: "Forbidden",
      url: "https://natashaskitchen.com/beef-stroganoff/",
      text: async () => CHALLENGE,
    });
    const renderPage = vi.fn().mockResolvedValue(NATASHA);

    const result = await fetchHtml("https://natashaskitchen.com/beef-stroganoff/", {
      fetchImpl: fetchMock as unknown as typeof fetch,
      renderPage,
      env: { RECIPE_IMPORT_CACHE_FALLBACK: "0" },
    });
    expect(result.via).toBe("headless");
    expect(renderPage).toHaveBeenCalledWith("https://natashaskitchen.com/beef-stroganoff/");
    expect(extractJsonLd(result.html)?.name).toMatch(/stroganoff/i);
  });

  it("uses a public cache before headless Chromium so Vercel does not time out", async () => {
    const live = "https://www.budgetbytes.com/beef-stroganoff/";
    const renderPage = vi.fn().mockResolvedValue(CHALLENGE);
    const fetchMock = vi.fn(async (requested: string) => {
      if (requested === live) {
        return {
          ok: false,
          status: 403,
          statusText: "Forbidden",
          url: live,
          text: async () => CHALLENGE,
        };
      }
      if (requested.includes("archive.org")) {
        return {
          ok: true,
          status: 200,
          statusText: "OK",
          url: requested,
          text: async () =>
            requested.includes("available") ? '{"archived_snapshots":{}}' : BUDGET,
        };
      }
      return {
        ok: false,
        status: 451,
        statusText: "Unavailable For Legal Reasons",
        url: requested,
        text: async () => "excluded",
      };
    });

    const result = await fetchHtml(live, {
      fetchImpl: fetchMock as unknown as typeof fetch,
      renderPage,
    });
    expect(result.via).toBe("cache");
    expect(result.url).toBe(live);
    expect(extractJsonLd(result.html)?.name).toBe("Beef Stroganoff");
    expect(renderPage).not.toHaveBeenCalled();
    expect(fetchMock.mock.calls.some((call) => String(call[0]).includes("web/2id_"))).toBe(true);
    expect(waybackIdentityUrl(live)).toContain("web/2id_/");
    expect(waybackMachineUrl(live)).toContain("web/2/");
  });

  it("uses the Jina HTML copy when Wayback is blocked", async () => {
    const live = "https://natashaskitchen.com/beef-stroganoff/";
    const fetchMock = vi.fn(async (requested: string) => {
      if (
        requested === live ||
        requested.includes("archive.org") ||
        requested.includes("translate.google") ||
        requested.includes("translate.goog")
      ) {
        return {
          ok: false,
          status: requested.includes("jina") ? 451 : 403,
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

  it("uses the Google Translate copy when Wayback and Jina are blocked", async () => {
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
    expect(result.via).toBe("direct");
    expect(result.html).toMatch(/Ingredients/);
  });

  it("treats a Wayback Athena shell as unusable", () => {
    const shell =
      "<html><head><title>Wayback Machine</title><script src='https://web.archive.org/athena.js'></script></head><body>playback</body></html>";
    expect(looksLikeWaybackShell(shell)).toBe(true);
    expect(isUsableRecipeHtml(shell)).toBe(false);
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

  it("throws a paste-text fallback when every layer fails", async () => {
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
        env: { RECIPE_IMPORT_CACHE_FALLBACK: "0" },
      })
    ).rejects.toBeInstanceOf(RecipeImportFetchError);
  });
});
