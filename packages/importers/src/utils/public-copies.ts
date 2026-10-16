/* eslint-disable no-undef */

/** Wayback JS playback (rewrite) copy. */
export function waybackMachineUrl(url: string): string {
  return `https://web.archive.org/web/2/${url}`;
}

/** Wayback identity copy: original bytes, no Athena player shell. */
export function waybackIdentityUrl(url: string): string {
  return `https://web.archive.org/web/2id_/${url}`;
}

export function waybackSnapshotIdentityUrl(timestamp: string, url: string): string {
  return `https://web.archive.org/web/${timestamp}id_/${url}`;
}

export function waybackAvailableUrl(url: string): string {
  return `https://archive.org/wayback/available?url=${encodeURIComponent(url)}`;
}

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

/** Free public copies. No API key. */
export function publicCopyRequests(url: string): PublicCopy[] {
  return [
    { url: waybackIdentityUrl(url), label: "wayback-identity" },
    { url: waybackMachineUrl(url), label: "wayback" },
    { url: jinaReaderUrl(url), headers: { "X-Return-Format": "html" }, label: "jina-html" },
    { url: jinaReaderUrl(url), label: "jina-markdown" },
    { url: googleTranslateUrl(url), label: "google-translate" },
    { url: translateGoogUrl(url), label: "translate-goog" },
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

export function parseWaybackAvailable(json: string): string | null {
  try {
    const data = JSON.parse(json) as {
      archived_snapshots?: { closest?: { available?: boolean; timestamp?: string; url?: string } };
    };
    const closest = data.archived_snapshots?.closest;
    if (!closest?.available || !closest.timestamp || !closest.url) return null;
    const original = closest.url.replace(/^https?:\/\/web\.archive\.org\/web\/\d+\//, "");
    return waybackSnapshotIdentityUrl(closest.timestamp, original);
  } catch {
    return null;
  }
}
