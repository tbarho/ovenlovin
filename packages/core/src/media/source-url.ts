/* eslint-disable no-undef */
const DROP_PARAMS = /^(utm_|fbclid$|gclid$|mc_|igsh$|igshid$)/i;

const INSTAGRAM_HOST = /(^|\.)instagram\.com$/i;
const INSTAGRAM_POST = /^\/(?:[A-Za-z0-9._]{1,30}\/)?(reel|reels|p)\/([A-Za-z0-9_-]+)\/?$/i;

export type InstagramPostKind = "reel" | "post";

/** Canonical public permalink for a Reel or photo post, or null when it is not one. */
export function canonicalInstagramPermalink(url: string): {
  permalink: string;
  kind: InstagramPostKind;
} | null {
  const trimmed = url.trim();
  if (!trimmed) return null;
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return null;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
  if (!INSTAGRAM_HOST.test(parsed.hostname)) return null;
  const match = parsed.pathname.match(INSTAGRAM_POST);
  const segment = match?.[1]?.toLowerCase();
  const code = match?.[2];
  if (!segment || !code) return null;
  const kind: InstagramPostKind = segment === "p" ? "post" : "reel";
  const canonicalSegment = kind === "post" ? "p" : "reel";
  return {
    permalink: `https://www.instagram.com/${canonicalSegment}/${code}`,
    kind,
  };
}

export function normalizeSourceUrl(url: string): string | null {
  const instagram = canonicalInstagramPermalink(url);
  if (instagram) return instagram.permalink;
  const trimmed = url.trim();
  if (!trimmed) return null;
  try {
    const parsed = new URL(trimmed);
    parsed.hash = "";
    parsed.hostname = parsed.hostname.toLowerCase();
    for (const key of [...parsed.searchParams.keys()]) {
      if (DROP_PARAMS.test(key)) parsed.searchParams.delete(key);
    }
    parsed.pathname = parsed.pathname.replace(/\/+$/, "") || "/";
    return parsed.toString();
  } catch {
    return trimmed;
  }
}
