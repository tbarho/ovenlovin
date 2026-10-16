/* eslint-disable no-undef */

export type ScrapeProvider = "browserless" | "scrapingbee" | "custom";

export type ScrapeServiceConfig = {
  provider: ScrapeProvider;
  url: string;
  token?: string;
};

export type ScrapeServiceOptions = {
  fetchImpl?: typeof fetch;
  env?: Record<string, string | undefined>;
};

/**
 * Optional remote browser. Off unless an env var is set.
 *
 * - BROWSERLESS_URL + BROWSERLESS_TOKEN (or BROWSERLESS_API_TOKEN)
 * - SCRAPINGBEE_API_KEY
 * - RECIPE_IMPORT_SCRAPE_URL (+ optional RECIPE_IMPORT_SCRAPE_TOKEN)
 *
 * Disable with RECIPE_IMPORT_SCRAPE=0.
 */
export function resolveScrapeService(
  env: Record<string, string | undefined> = process.env
): ScrapeServiceConfig | null {
  if (env.RECIPE_IMPORT_SCRAPE === "0") return null;

  const browserlessUrl = env.BROWSERLESS_URL?.trim();
  const browserlessToken = (env.BROWSERLESS_TOKEN || env.BROWSERLESS_API_TOKEN || "").trim();
  if (browserlessUrl) {
    return {
      provider: "browserless",
      url: browserlessUrl.replace(/\/$/, ""),
      token: browserlessToken || undefined,
    };
  }

  const scrapingBeeKey = env.SCRAPINGBEE_API_KEY?.trim();
  if (scrapingBeeKey) {
    return {
      provider: "scrapingbee",
      url: "https://app.scrapingbee.com/api/v1",
      token: scrapingBeeKey,
    };
  }

  const customUrl = env.RECIPE_IMPORT_SCRAPE_URL?.trim();
  if (customUrl) {
    return {
      provider: "custom",
      url: customUrl,
      token: env.RECIPE_IMPORT_SCRAPE_TOKEN?.trim() || undefined,
    };
  }

  return null;
}

function withToken(base: string, token?: string): string {
  if (!token) return base;
  const joiner = base.includes("?") ? "&" : "?";
  return `${base}${joiner}token=${encodeURIComponent(token)}`;
}

export async function scrapeRemotePage(
  targetUrl: string,
  options: ScrapeServiceOptions = {}
): Promise<string | null> {
  const env = options.env ?? process.env;
  const config = resolveScrapeService(env);
  if (!config) return null;
  const fetchImpl = options.fetchImpl ?? fetch;

  try {
    if (config.provider === "browserless") {
      const endpoint = withToken(`${config.url}/content`, config.token);
      const response = await fetchImpl(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "text/html" },
        body: JSON.stringify({
          url: targetUrl,
          gotoOptions: { waitUntil: "networkidle2", timeout: 20_000 },
        }),
      });
      if (!response.ok) return null;
      const html = await response.text();
      return html.trim() ? html : null;
    }

    if (config.provider === "scrapingbee") {
      const params = new URLSearchParams({
        api_key: config.token ?? "",
        url: targetUrl,
        render_js: "true",
        wait_browser: "networkidle2",
      });
      const response = await fetchImpl(`${config.url}?${params.toString()}`, {
        headers: {
          Accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
        },
      });
      if (!response.ok) return null;
      const html = await response.text();
      return html.trim() ? html : null;
    }

    const response = await fetchImpl(config.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "text/html",
        ...(config.token ? { Authorization: `Bearer ${config.token}` } : {}),
      },
      body: JSON.stringify({ url: targetUrl }),
    });
    if (!response.ok) return null;
    const html = await response.text();
    return html.trim() ? html : null;
  } catch {
    return null;
  }
}
