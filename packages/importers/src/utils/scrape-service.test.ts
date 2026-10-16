import { describe, expect, it, vi } from "vitest";
import { resolveScrapeService, scrapeRemotePage } from "./scrape-service";

describe("resolveScrapeService", () => {
  it("is off when no env is set", () => {
    expect(resolveScrapeService({})).toBeNull();
  });

  it("can be disabled even when a key is present", () => {
    expect(
      resolveScrapeService({ RECIPE_IMPORT_SCRAPE: "0", SCRAPINGBEE_API_KEY: "bee" })
    ).toBeNull();
  });

  it("resolves Browserless from URL and token", () => {
    expect(
      resolveScrapeService({
        BROWSERLESS_URL: "https://chrome.browserless.io/",
        BROWSERLESS_TOKEN: "tok",
      })
    ).toEqual({
      provider: "browserless",
      url: "https://chrome.browserless.io",
      token: "tok",
    });
  });

  it("resolves ScrapingBee from an API key", () => {
    expect(resolveScrapeService({ SCRAPINGBEE_API_KEY: "bee-key" })).toEqual({
      provider: "scrapingbee",
      url: "https://app.scrapingbee.com/api/v1",
      token: "bee-key",
    });
  });

  it("resolves a custom scrape URL", () => {
    expect(
      resolveScrapeService({
        RECIPE_IMPORT_SCRAPE_URL: "https://scrape.example/html",
        RECIPE_IMPORT_SCRAPE_TOKEN: "custom",
      })
    ).toEqual({
      provider: "custom",
      url: "https://scrape.example/html",
      token: "custom",
    });
  });
});

describe("scrapeRemotePage", () => {
  it("returns null when no service is configured", async () => {
    expect(await scrapeRemotePage("https://example.com", { env: {} })).toBeNull();
  });

  it("posts the target URL to Browserless /content", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => "<html><body>recipe</body></html>",
    });

    const html = await scrapeRemotePage("https://www.budgetbytes.com/beef-stroganoff/", {
      fetchImpl: fetchMock as unknown as typeof fetch,
      env: {
        BROWSERLESS_URL: "https://chrome.browserless.io",
        BROWSERLESS_TOKEN: "tok",
      },
    });

    expect(html).toMatch(/recipe/);
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe(
      "https://chrome.browserless.io/content?token=tok"
    );
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({ method: "POST" });
    const body = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));
    expect(body.url).toBe("https://www.budgetbytes.com/beef-stroganoff/");
    expect(body.gotoOptions.waitUntil).toBe("networkidle2");
  });

  it("calls ScrapingBee with render_js", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => "<html>ok</html>",
    });

    await scrapeRemotePage("https://example.com/cookies", {
      fetchImpl: fetchMock as unknown as typeof fetch,
      env: { SCRAPINGBEE_API_KEY: "bee" },
    });

    const requested = String(fetchMock.mock.calls[0]?.[0]);
    expect(requested).toContain("app.scrapingbee.com/api/v1");
    expect(requested).toContain("api_key=bee");
    expect(requested).toContain("render_js=true");
    expect(requested).toContain(encodeURIComponent("https://example.com/cookies"));
  });
});
