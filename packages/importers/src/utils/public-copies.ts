/* eslint-disable no-undef */

export function jinaReaderUrl(url: string): string {
  return `https://r.jina.ai/${url}`;
}

/** People Inc. sites often 451 Jina; Google's fetch still carries JSON-LD. */
export function googleTranslateUrl(url: string): string {
  return `https://translate.google.com/translate?sl=auto&tl=en&u=${encodeURIComponent(url)}`;
}

/** Direct translate.goog host used after the Google Translate hop. */
export function translateGoogUrl(url: string): string {
  const parsed = new URL(url);
  const host = `${parsed.hostname.replace(/\./g, "-")}.translate.goog`;
  const query = parsed.search ? `${parsed.search}&` : "?";
  return `${parsed.protocol}//${host}${parsed.pathname}${query}_x_tr_sl=auto&_x_tr_tl=en&_x_tr_pto=wapp`;
}

export type PublicCopy = {
  url: string;
  headers?: Record<string, string>;
  label: string;
};

/** Free public copies. No API key. Translate first: it still carries JSON-LD when Jina 451s. */
export function publicCopyRequests(url: string): PublicCopy[] {
  return [
    { url: googleTranslateUrl(url), label: "google-translate" },
    { url: translateGoogUrl(url), label: "translate-goog" },
    { url: jinaReaderUrl(url), headers: { "X-Return-Format": "html" }, label: "jina-html" },
    { url: jinaReaderUrl(url), label: "jina-markdown" },
  ];
}

/**
 * Nearby live URLs to try after a 404.
 * Wikibooks Cookbook:Pancakes is a missing title; Cookbook:Pancake is live.
 */
export function relatedRecipeUrls(url: string): string[] {
  try {
    const parsed = new URL(url);
    if (/\/Cookbook:Pancakes\/?$/i.test(parsed.pathname)) {
      const next = new URL(parsed.href);
      next.pathname = parsed.pathname.replace(/Pancakes\/?$/i, "Pancake");
      return [next.toString()];
    }
  } catch {
    return [];
  }
  return [];
}
