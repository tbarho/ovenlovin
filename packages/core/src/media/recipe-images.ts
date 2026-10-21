/* eslint-disable no-undef */
import { createHash } from "crypto";

const BLOB_HOST_HINTS = ["public.blob.vercel-storage.com", "blob.vercel-storage.com"];

/** Stored jsonb may contain objects from a bad write. Only keep string URLs. */
export function normalizeStoredRecipeImages(images: unknown): string[] {
  if (!Array.isArray(images)) return [];
  return images.filter(
    (item): item is string => typeof item === "string" && item.trim().length > 0
  );
}

export function recipeMainImage(images: unknown): string | null {
  return normalizeStoredRecipeImages(images)[0] ?? null;
}

export function recipeGalleryImages(images: unknown): string[] {
  return normalizeStoredRecipeImages(images);
}

/** Import and recipe-detail persist only the main photo. Cookbook mosaics still use one image per recipe. */
export function keepMainRecipeImages(images: string[] | null | undefined): string[] {
  const main = recipeMainImage(images);
  return main ? [main] : [];
}

export function isStoredBlobUrl(url: string): boolean {
  try {
    const host = new URL(url).host;
    return BLOB_HOST_HINTS.some((hint) => host.endsWith(hint));
  } catch {
    return false;
  }
}

const PRIVATE_IMAGE_HOST = /^(localhost|0\.0\.0\.0)$|(\.localhost|\.local|\.internal)$/i;
const IPV4_LITERAL = /^(?:25[0-5]|2[0-4]\d|1?\d?\d)(?:\.(?:25[0-5]|2[0-4]\d|1?\d?\d)){3}$/;

function isIpv4Literal(host: string): boolean {
  return IPV4_LITERAL.test(host);
}

function isIpLiteral(host: string): boolean {
  return host.includes(":") || isIpv4Literal(host);
}

function ipv4FromMapped(host: string): string | null {
  if (!host.startsWith("::ffff:")) return null;
  const rest = host.slice(7);
  if (isIpv4Literal(rest)) return rest;
  const parts = rest.split(":");
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null;
  const hi = Number.parseInt(parts[0], 16);
  const lo = Number.parseInt(parts[1], 16);
  if (!Number.isInteger(hi) || !Number.isInteger(lo)) return null;
  return `${(hi >> 8) & 255}.${hi & 255}.${(lo >> 8) & 255}.${lo & 255}`;
}

function isPrivateRecipeImageIp(address: string): boolean {
  const host = address.toLowerCase().replace(/^\[|\]$/g, "");
  const mapped = ipv4FromMapped(host);
  if (mapped) return isPrivateRecipeImageIp(mapped);
  if (isIpv4Literal(host)) {
    const [a, b] = host.split(".").map(Number);
    if (a === 0 || a === 10 || a === 127) return true;
    if (a === 169 && b === 254) return true;
    if (a === 192 && b === 168) return true;
    if (a === 172 && b != null && b >= 16 && b <= 31) return true;
    if (a === 100 && b != null && b >= 64 && b <= 127) return true;
    if (a === 198 && (b === 18 || b === 19)) return true;
    if (a != null && a >= 224 && a <= 239) return true;
    return false;
  }
  if (!host.includes(":")) return false;
  if (host === "::1" || host === "::") return true;
  if (host.startsWith("64:ff9b::") || /^64:ff9b:(?:0+:){4}/.test(host)) return true;
  const first = host.split(":")[0] ?? "";
  return (
    /^f[cd][0-9a-f]{2}$/.test(first) ||
    /^fe[89ab][0-9a-f]$/.test(first) ||
    /^ff[0-9a-f]{2}$/.test(first)
  );
}

function imageHostName(url: string): string | null {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^\[|\]$/g, "");
  } catch {
    return null;
  }
}

/** Hostname or literal IP we must never fetch. DNS-to-private is checked at fetch time. */
function isBlockedRecipeImageHost(host: string): boolean {
  const name = host.toLowerCase().replace(/^\[|\]$/g, "");
  return PRIVATE_IMAGE_HOST.test(name) || isPrivateRecipeImageIp(name);
}

/** Only fetch images we would also request on a first import, never localhost or link-local. */
export function isFetchableRecipeImageUrl(url: string): boolean {
  if (isStoredBlobUrl(url)) return true;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return false;
    return !isBlockedRecipeImageHost(parsed.hostname);
  } catch {
    return false;
  }
}

export const INVALID_IMAGE_URL_CODE = "invalid_image_url";
export const INVALID_IMAGE_URL_MESSAGE =
  "Use a public http(s) image URL, a stored blob URL, or an inline image.";

/** User-supplied image refs we may store, fetch, or send to a model. */
export function isAllowedRecipeImageUrl(url: string): boolean {
  if (isInlineImageDataUrl(url)) return true;
  if (!isFetchableRecipeImageUrl(url)) return false;
  if (isStoredBlobUrl(url)) return true;
  try {
    return /\.(png|webp|gif|avif|jpe?g)$/i.test(new URL(url).pathname);
  } catch {
    return false;
  }
}

export class InvalidImageUrlError extends Error {
  readonly code = INVALID_IMAGE_URL_CODE;

  constructor() {
    super(INVALID_IMAGE_URL_MESSAGE);
    this.name = "InvalidImageUrlError";
  }
}

export function assertAllowedRecipeImageUrls(urls: readonly unknown[]): void {
  for (const url of urls) {
    if (typeof url !== "string" || !url.trim()) continue;
    if (!isAllowedRecipeImageUrl(url)) throw new InvalidImageUrlError();
  }
}

async function assertPublicImageUrl(url: string): Promise<void> {
  if (!isFetchableRecipeImageUrl(url)) throw new Error("blocked image url");
  const host = imageHostName(url);
  if (!host || isStoredBlobUrl(url) || isIpLiteral(host)) return;
  try {
    // Client bundles import this file for URL helpers; only the server fetch path loads dns.
    const { lookup } = await import(/* webpackIgnore: true */ "dns/promises");
    const answers = await lookup(host, { all: true });
    if (answers.some((entry) => isPrivateRecipeImageIp(entry.address))) {
      throw new Error("blocked image url");
    }
  } catch (error) {
    if (error instanceof Error && error.message === "blocked image url") throw error;
  }
}

export function imageExtensionFromUrl(url: string, contentType?: string | null): string {
  const fromType = contentType?.split(";")[0]?.trim().toLowerCase();
  if (fromType === "image/png") return "png";
  if (fromType === "image/webp") return "webp";
  if (fromType === "image/gif") return "gif";
  if (fromType === "image/avif") return "avif";
  if (fromType === "image/jpeg" || fromType === "image/jpg") return "jpg";

  try {
    const pathname = new URL(url).pathname.toLowerCase();
    const match = pathname.match(/\.(png|webp|gif|avif|jpe?g)$/);
    if (match?.[1]) return match[1] === "jpeg" ? "jpg" : match[1];
  } catch {
    // keep default
  }
  return "jpg";
}

export type ImagePutInput = {
  pathname: string;
  body: ArrayBuffer;
  contentType: string;
};

export type StoredImagePut = {
  // eslint-disable-next-line no-unused-vars
  (input: ImagePutInput): Promise<string | null>;
};

/** Sites that 403 the importer UA often 403 bare image fetches too. */
export const RECIPE_IMAGE_FETCH_HEADERS: Record<string, string> = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
};

const BLOCKED_IMAGE_STATUSES = new Set([401, 403, 406, 429]);

export function headersForRemoteImage(url: string): Record<string, string> {
  try {
    return { ...RECIPE_IMAGE_FETCH_HEADERS, Referer: `${new URL(url).origin}/` };
  } catch {
    return { ...RECIPE_IMAGE_FETCH_HEADERS };
  }
}

export function isBlobStoreConfigured(
  env: Record<string, string | undefined> = process.env
): boolean {
  return Boolean(env.BLOB_READ_WRITE_TOKEN);
}

export function isInlineImageDataUrl(value: string): boolean {
  return /^\s*data:image\/[a-z0-9.+-]+;base64,/i.test(value);
}

export function parseImageDataUrl(
  dataUrl: string
): { contentType: string; body: ArrayBuffer } | null {
  const match = dataUrl.trim().match(/^data:([^;,]+);base64,(.+)$/i);
  if (!match?.[1] || !match[2]) return null;
  const contentType = match[1];
  if (!contentType.toLowerCase().startsWith("image/")) return null;
  const bytes = Buffer.from(match[2], "base64");
  if (bytes.byteLength === 0 || bytes.byteLength > 12 * 1024 * 1024) return null;
  return {
    contentType,
    body: bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
  };
}

export function recipeImageEndpointPath(recipeId: string): string {
  return `/api/v1/recipes/${recipeId}/image`;
}

export function withPublicOrigin(pathOrUrl: string, origin?: string): string {
  if (!origin || /^(https?:|data:)/i.test(pathOrUrl)) return pathOrUrl;
  const base = origin.replace(/\/$/, "");
  return `${base}${pathOrUrl.startsWith("/") ? pathOrUrl : `/${pathOrUrl}`}`;
}

export function appOriginFromEnv(
  env: Record<string, string | undefined> = process.env
): string | undefined {
  const configured = env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");
  if (configured) return configured;
  if (env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${env.VERCEL_PROJECT_PRODUCTION_URL}`;
  }
  if (env.VERCEL_URL) return `https://${env.VERCEL_URL}`;
  return undefined;
}

/** Drop inline data URLs so list/search payloads stay small. */
export function omitInlineImagePayloads(values: unknown): string[] {
  return normalizeStoredRecipeImages(values).filter((value) => !isInlineImageDataUrl(value));
}

/** Stable id for a photo import: URL as-is, or sha256 of inline bytes. */
export function fingerprintImageBlob(blob: string): string {
  const trimmed = blob.trim();
  if (/^https?:\/\//i.test(trimmed)) return `url:${trimmed}`;
  const dataUrl = isInlineImageDataUrl(trimmed)
    ? trimmed
    : `data:image/jpeg;base64,${trimmed.replace(/\s+/g, "")}`;
  const parsed = parseImageDataUrl(dataUrl);
  const bytes = parsed ? Buffer.from(parsed.body) : Buffer.from(trimmed);
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

/** REST/MCP preview JSON: never inline base64; keep http(s) / Blob URLs. */
export function presentPhotoImportImages(images: string[] | null | undefined): string[] {
  return keepMainRecipeImages(omitInlineImagePayloads(images));
}

/**
 * One thumbnail URL for list/search/detail JSON. Inline bytes become the
 * household-scoped image endpoint until Blob (or a later backfill) stores a URL.
 */
export function publicRecipeImages(
  recipeId: string,
  images: string[] | null | undefined,
  options?: { origin?: string }
): string[] {
  const main = recipeMainImage(images);
  if (!main) return [];
  if (isInlineImageDataUrl(main)) {
    return [withPublicOrigin(recipeImageEndpointPath(recipeId), options?.origin)];
  }
  return [main];
}

export function publicRecipeImageUrl(
  recipeId: string,
  image: string | null | undefined,
  options?: { origin?: string }
): string | null {
  if (!image?.trim()) return null;
  return publicRecipeImages(recipeId, [image], options)[0] ?? null;
}

export function presentRecipeImages<T extends { id: string; images?: string[] | null }>(
  recipe: T,
  options?: { origin?: string }
): T {
  return {
    ...recipe,
    images: publicRecipeImages(recipe.id, recipe.images, options),
  };
}

export async function persistRecipeImageUrl(
  url: string,
  put: StoredImagePut | undefined,
  pathnameWithoutExt: string
): Promise<string> {
  if (!isInlineImageDataUrl(url) || !put) return url;
  const parsed = parseImageDataUrl(url);
  if (!parsed) return url;
  const stored = await put({
    pathname: `${pathnameWithoutExt}.${imageExtensionFromUrl(url, parsed.contentType)}`,
    body: parsed.body,
    contentType: parsed.contentType,
  });
  return stored ?? url;
}

export async function backfillInlineImageList(
  images: string[],
  put: StoredImagePut | undefined,
  prefix: string
): Promise<{ images: string[]; changed: boolean }> {
  const next: string[] = [];
  let changed = false;
  for (const [index, url] of images.entries()) {
    const stored = await persistRecipeImageUrl(url, put, `${prefix}/${index + 1}`);
    next.push(stored);
    if (stored !== url) changed = true;
  }
  return { images: keepMainRecipeImages(next), changed };
}

function isRedirectResponse(response: Response): boolean {
  return (
    response.status >= 300 && response.status < 400 && Boolean(response.headers.get("location"))
  );
}

async function fetchImageHop(url: string, headers: Record<string, string>): Promise<Response> {
  return fetch(url, { redirect: "manual", headers });
}

async function fetchRemoteImage(url: string): Promise<Response> {
  let current = url;
  await assertPublicImageUrl(current);
  let response = await fetchImageHop(current, headersForRemoteImage(current));
  // shortcut: 5 hops, upgrade if a recipe CDN needs a longer chain
  for (let hops = 0; hops < 5 && isRedirectResponse(response); hops += 1) {
    const location = response.headers.get("location");
    if (!location) break;
    current = new URL(location, current).href;
    await assertPublicImageUrl(current);
    response = await fetchImageHop(current, headersForRemoteImage(current));
  }
  if (!response.ok && BLOCKED_IMAGE_STATUSES.has(response.status)) {
    response = await fetchImageHop(current, {
      ...headersForRemoteImage(current),
      "Cache-Control": "no-cache",
    });
  }
  return response;
}

export async function copyRemoteImages(
  urls: string[],
  put: StoredImagePut | undefined,
  prefix: string
): Promise<string[]> {
  const unique = [...new Set(urls.filter((url) => isFetchableRecipeImageUrl(url)))];
  if (unique.length === 0) return [];
  if (!put) return unique;

  const copied: string[] = [];
  for (const [index, url] of unique.entries()) {
    if (isStoredBlobUrl(url)) {
      copied.push(url);
      continue;
    }

    try {
      const response = await fetchRemoteImage(url);
      if (!response.ok) {
        copied.push(url);
        continue;
      }

      const contentType = response.headers.get("content-type") ?? "image/jpeg";
      if (!contentType.startsWith("image/")) {
        continue;
      }

      const body = await response.arrayBuffer();
      if (body.byteLength === 0 || body.byteLength > 12 * 1024 * 1024) {
        copied.push(url);
        continue;
      }

      const stored = await put({
        pathname: `${prefix}/${index + 1}.${imageExtensionFromUrl(url, contentType)}`,
        body,
        contentType,
      });
      copied.push(stored ?? url);
    } catch {
      // blocked or refused: never keep a private or unfetched URL
    }
  }

  return copied;
}
