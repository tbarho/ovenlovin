import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  FULL_BROWSER_HEADERS,
  RecipeImportFetchError,
  fetchHtml,
  isUsableRecipeHtml,
  looksLikeBotChallenge,
  jinaReaderUrl,
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

  it("falls back to the Wayback Machine when direct and headless fail", async () => {
    const live = "https://www.budgetbytes.com/beef-stroganoff/";
    const fetchMock = vi.fn(async (url: string) => {
      if (url === live) {
        return {
          ok: false,
          status: 403,
          statusText: "Forbidden",
          url: live,
          text: async () => CHALLENGE,
        };
      }
      expect(url).toBe(waybackMachineUrl(live));
      return {
        ok: true,
        status: 200,
        statusText: "OK",
        url,
        text: async () => BUDGET,
      };
    });

    const result = await fetchHtml(live, {
      fetchImpl: fetchMock as unknown as typeof fetch,
      renderPage: async () => CHALLENGE,
    });
    expect(result.via).toBe("cache");
    expect(result.url).toBe(live);
    expect(extractJsonLd(result.html)?.name).toBe("Beef Stroganoff");
  });

  it("uses the Jina HTML copy when Wayback is blocked", async () => {
    const live = "https://natashaskitchen.com/beef-stroganoff/";
    const fetchMock = vi.fn(async (requested: string) => {
      if (requested === live || requested.includes("web.archive.org")) {
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
