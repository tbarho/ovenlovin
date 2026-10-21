/* eslint-disable no-undef */
import { createHash } from "crypto";
import {
  assertPublicHttpUrl,
  fetchPublicHttp,
  isPublicHttpUrl,
  NotAPublicUrlError,
} from "./public-http-url";

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

/** Only fetch images we would also request on a first import, never localhost or link-local. */
export function isFetchableRecipeImageUrl(url: string): boolean {
  return isStoredBlobUrl(url) || isPublicHttpUrl(url);
}

export const INVALID_IMAGE_URL_CODE = "invalid_image_url";
export const INVALID_IMAGE_URL_MESSAGE =
  "Use a public http(s) image URL, a stored blob URL, or an inline image.";

/** User-supplied image refs we may store, fetch, or send to a model. */
export function isAllowedRecipeImageUrl(url: string): boolean {
  return isInlineImageDataUrl(url) || isFetchableRecipeImageUrl(url);
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
  if (isStoredBlobUrl(url)) return;
  await assertPublicHttpUrl(url);
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

async function fetchRemoteImage(url: string): Promise<Response> {
  await assertPublicImageUrl(url);
  let response = await fetchPublicHttp(url, { headers: headersForRemoteImage(url) });
  if (!response.ok && BLOCKED_IMAGE_STATUSES.has(response.status)) {
    const current = response.url || url;
    await assertPublicImageUrl(current);
    response = await fetchPublicHttp(current, {
      headers: {
        ...headersForRemoteImage(current),
        "Cache-Control": "no-cache",
      },
    });
  }
  return response;
}

/** Download a user image URL ourselves so the model never fetches it. */
export async function inlinePublicImageBlob(blob: string): Promise<string> {
  const trimmed = blob.trim();
  if (isInlineImageDataUrl(trimmed)) return trimmed;
  if (!isPublicHttpUrl(trimmed)) throw new NotAPublicUrlError();
  const response = await fetchRemoteImage(trimmed);
  const contentType = response.headers.get("content-type") ?? "";
  if (!response.ok || !contentType.startsWith("image/")) throw new InvalidImageUrlError();
  const body = Buffer.from(await response.arrayBuffer());
  if (body.byteLength === 0 || body.byteLength > 12 * 1024 * 1024) {
    throw new InvalidImageUrlError();
  }
  const mime = contentType.split(";")[0]?.trim() || "image/jpeg";
  return `data:${mime};base64,${body.toString("base64")}`;
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
