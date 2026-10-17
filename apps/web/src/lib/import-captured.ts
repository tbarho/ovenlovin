import { looksLikeHttpUrl } from "@/lib/import-input";

export type CapturedPageInput = {
  url: string;
  html?: string;
  jsonLd?: Record<string, unknown>;
};

export function parseCapturedPage(body: unknown): CapturedPageInput {
  const record = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const url = typeof record.url === "string" ? record.url.trim() : "";
  if (!looksLikeHttpUrl(url)) {
    throw new Error("Provide the recipe page URL");
  }

  let jsonLd: Record<string, unknown> | undefined;
  if (typeof record.jsonLd === "string" && record.jsonLd.trim()) {
    try {
      const parsed = JSON.parse(record.jsonLd) as unknown;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        jsonLd = parsed as Record<string, unknown>;
      }
    } catch {
      throw new Error("jsonLd must be a JSON object");
    }
  } else if (record.jsonLd && typeof record.jsonLd === "object" && !Array.isArray(record.jsonLd)) {
    jsonLd = record.jsonLd as Record<string, unknown>;
  }

  const html = typeof record.html === "string" ? record.html : undefined;
  if (!html?.trim() && !jsonLd) {
    throw new Error("Provide the page HTML or JSON-LD recipe");
  }

  return { url, html, jsonLd };
}

export function parseCaptureHash(hash: string): CapturedPageInput {
  const raw = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!raw.trim()) {
    throw new Error("No page was sent. Open a recipe, then tap Save to OvenLovin.");
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(decodeURIComponent(raw));
  } catch {
    throw new Error("The bookmarklet payload was not valid JSON");
  }
  return parseCapturedPage(parsed);
}
