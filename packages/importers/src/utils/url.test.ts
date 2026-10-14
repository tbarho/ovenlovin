import { afterEach, describe, it, expect, vi } from "vitest";
import {
  parseDuration,
  extractAuthor,
  extractImages,
  extractPageImages,
  fetchHtml,
  pickImportRecipeImage,
  RecipeImportFetchError,
  shouldRetryFetchWithBrowserHeaders,
} from "./url";

describe("parseDuration", () => {
  it("should parse hours and minutes", () => {
    expect(parseDuration("PT1H30M")).toBe(90);
    expect(parseDuration("PT2H")).toBe(120);
    expect(parseDuration("PT45M")).toBe(45);
  });

  it("should handle missing hours or minutes", () => {
    expect(parseDuration("PT15M")).toBe(15);
    expect(parseDuration("PT3H")).toBe(180);
  });

  it("should return undefined for invalid durations", () => {
    expect(parseDuration("")).toBeUndefined();
    expect(parseDuration("invalid")).toBeUndefined();
  });

  it("should parse day-length ISO durations", () => {
    expect(parseDuration("P1DT2H")).toBe(1560);
  });

  it("should parse human-readable durations", () => {
    expect(parseDuration("1 hour 15 minutes")).toBe(75);
  });
});

describe("extractAuthor", () => {
  it("should extract author from string", () => {
    expect(extractAuthor({ author: "John Doe" })).toBe("John Doe");
  });

  it("should extract author from object", () => {
    expect(extractAuthor({ author: { name: "Jane Smith" } })).toBe("Jane Smith");
  });

  it("should extract author from array", () => {
    expect(extractAuthor({ author: ["First Author"] })).toBe("First Author");
    expect(extractAuthor({ author: [{ name: "First Author" }] })).toBe("First Author");
  });

  it("should return undefined for missing author", () => {
    expect(extractAuthor({})).toBeUndefined();
  });
});

describe("extractImages", () => {
  it("should extract image from string", () => {
    expect(extractImages({ image: "https://example.com/image.jpg" })).toEqual([
      "https://example.com/image.jpg",
    ]);
  });

  it("should extract images from array", () => {
    expect(
      extractImages({
        image: ["https://example.com/1.jpg", "https://example.com/2.jpg"],
      })
    ).toEqual(["https://example.com/1.jpg", "https://example.com/2.jpg"]);
  });

  it("should extract image from object", () => {
    expect(extractImages({ image: { url: "https://example.com/image.jpg" } })).toEqual([
      "https://example.com/image.jpg",
    ]);
  });

  it("should extract images from array of objects", () => {
    expect(
      extractImages({
        image: [{ url: "https://example.com/1.jpg" }, { url: "https://example.com/2.jpg" }],
      })
    ).toEqual(["https://example.com/1.jpg", "https://example.com/2.jpg"]);
  });

  it("should return empty array for missing image", () => {
    expect(extractImages({})).toEqual([]);
  });
});

describe("pickImportRecipeImage", () => {
  it("picks the largest schema.org ImageObject by width × height", () => {
    expect(
      pickImportRecipeImage({
        image: [
          { url: "https://example.com/small.jpg", width: 200, height: 200 },
          { url: "https://example.com/hero.jpg", width: 1600, height: 900 },
          { url: "https://example.com/medium.jpg", width: 800, height: 600 },
        ],
      })
    ).toBe("https://example.com/hero.jpg");
  });

  it("keeps document order when ImageObject sizes are missing", () => {
    expect(
      pickImportRecipeImage({
        image: ["https://example.com/first.jpg", "https://example.com/second.jpg"],
      })
    ).toBe("https://example.com/first.jpg");
  });

  it("reads ImageObject contentUrl", () => {
    expect(
      pickImportRecipeImage({
        image: { contentUrl: "https://example.com/content.jpg", width: 1200, height: 800 },
      })
    ).toBe("https://example.com/content.jpg");
  });

  it("falls back to the first og/page image when schema has none", () => {
    expect(
      pickImportRecipeImage({}, ["https://example.com/og.jpg", "https://example.com/tw.jpg"])
    ).toBe("https://example.com/og.jpg");
  });

  it("ignores page images when a schema image exists", () => {
    expect(
      pickImportRecipeImage({ image: "https://example.com/schema.jpg" }, [
        "https://example.com/og.jpg",
      ])
    ).toBe("https://example.com/schema.jpg");
  });
});

describe("fetchHtml", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("retries a 403 with browser-like headers", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 403,
        statusText: "Forbidden",
        url: "https://natashaskitchen.com/beef-stroganoff/",
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: "OK",
        url: "https://natashaskitchen.com/beef-stroganoff/",
        text: async () => "<html><body>ok</body></html>",
      });
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchHtml("https://natashaskitchen.com/beef-stroganoff/");
    expect(result.html).toContain("ok");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const retryHeaders = fetchMock.mock.calls[1]?.[1]?.headers as Record<string, string>;
    expect(retryHeaders["User-Agent"]).toMatch(/Mozilla\/5\.0/);
  });

  it("throws a paste-text fallback after a blocked retry", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      statusText: "Forbidden",
      url: "https://natashaskitchen.com/beef-stroganoff/",
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchHtml("https://natashaskitchen.com/beef-stroganoff/")).rejects.toBeInstanceOf(
      RecipeImportFetchError
    );
    await expect(fetchHtml("https://natashaskitchen.com/beef-stroganoff/")).rejects.toThrow(
      /pasting the recipe text/
    );
    expect(shouldRetryFetchWithBrowserHeaders(403)).toBe(true);
  });
});

describe("extractPageImages", () => {
  it("reads og:image and twitter:image", () => {
    const html = `
      <html>
        <head>
          <meta property="og:image" content="https://example.com/og.jpg" />
          <meta name="twitter:image" content="https://example.com/tw.jpg" />
        </head>
      </html>
    `;
    expect(extractPageImages(html)).toEqual([
      "https://example.com/og.jpg",
      "https://example.com/tw.jpg",
    ]);
  });
});
