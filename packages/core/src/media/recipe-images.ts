/* eslint-disable no-undef */
const BLOB_HOST_HINTS = ["public.blob.vercel-storage.com", "blob.vercel-storage.com"];

export function recipeMainImage(images: string[] | null | undefined): string | null {
  return images?.find((image) => image.trim().length > 0) ?? null;
}

export function recipeGalleryImages(images: string[] | null | undefined): string[] {
  return (images ?? []).filter((image) => image.trim().length > 0);
}

export function isStoredBlobUrl(url: string): boolean {
  try {
    const host = new URL(url).host;
    return BLOB_HOST_HINTS.some((hint) => host.endsWith(hint));
  } catch {
    return false;
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

export async function copyRemoteImages(
  urls: string[],
  put: StoredImagePut | undefined,
  prefix: string
): Promise<string[]> {
  const unique = [...new Set(urls.filter((url) => url.trim().length > 0))];
  if (unique.length === 0) return [];
  if (!put) return unique;

  const copied: string[] = [];
  for (const [index, url] of unique.entries()) {
    if (isStoredBlobUrl(url)) {
      copied.push(url);
      continue;
    }

    try {
      const response = await fetch(url, {
        redirect: "follow",
        headers: { Accept: "image/*,*/*;q=0.8" },
      });
      if (!response.ok) {
        copied.push(url);
        continue;
      }

      const contentType = response.headers.get("content-type") ?? "image/jpeg";
      if (!contentType.startsWith("image/")) {
        copied.push(url);
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
      copied.push(url);
    }
  }

  return copied;
}
