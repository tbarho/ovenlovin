import { describe, expect, it, vi } from "vitest";
import { lookup } from "dns/promises";

vi.mock("dns/promises", () => ({
  lookup: vi.fn(async () => [{ address: "93.184.216.34", family: 4 }]),
}));
import {
  appOriginFromEnv,
  backfillInlineImageList,
  copyRemoteImages,
  headersForRemoteImage,
  imageExtensionFromUrl,
  isBlobStoreConfigured,
  isInlineImageDataUrl,
  isFetchableRecipeImageUrl,
  isStoredBlobUrl,
  keepMainRecipeImages,
  omitInlineImagePayloads,
  parseImageDataUrl,
  presentPhotoImportImages,
  fingerprintImageBlob,
  persistRecipeImageUrl,
  presentRecipeImages,
  publicRecipeImages,
  recipeGalleryImages,
  recipeImageEndpointPath,
  recipeMainImage,
} from "./recipe-images";

const png =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
const dataUrl = `data:image/png;base64,${png}`;

describe("recipe images", () => {
  it("picks the first non-empty image as the main photo", () => {
    expect(recipeMainImage(["", "https://example.com/a.jpg"])).toBe("https://example.com/a.jpg");
    expect(recipeGalleryImages(["https://a", "", "https://b"])).toEqual(["https://a", "https://b"]);
    expect(keepMainRecipeImages(["", "https://a", "https://b"])).toEqual(["https://a"]);
    expect(keepMainRecipeImages([])).toEqual([]);
  });

  it("recognizes Vercel Blob URLs", () => {
    expect(isStoredBlobUrl("https://abc.public.blob.vercel-storage.com/cookies.jpg")).toBe(true);
    expect(isStoredBlobUrl("https://example.com/cookies.jpg")).toBe(false);
  });

  it("refuses to fetch localhost or link-local image URLs", () => {
    expect(isFetchableRecipeImageUrl("https://cdn.example/tomato.jpg")).toBe(true);
    expect(isFetchableRecipeImageUrl("http://127.0.0.1/secret.jpg")).toBe(false);
    expect(isFetchableRecipeImageUrl("http://169.254.169.254/latest/meta-data")).toBe(false);
    expect(isFetchableRecipeImageUrl("http://[::1]/secret.jpg")).toBe(false);
    expect(isFetchableRecipeImageUrl("http://[fc00::1]/secret.jpg")).toBe(false);
    expect(isFetchableRecipeImageUrl("http://[fe80::1]/secret.jpg")).toBe(false);
    expect(isFetchableRecipeImageUrl("http://[::ffff:127.0.0.1]/secret.jpg")).toBe(false);
    expect(isFetchableRecipeImageUrl("http://[::ffff:10.1.2.3]/secret.jpg")).toBe(false);
    expect(isFetchableRecipeImageUrl("http://100.64.0.1/secret.jpg")).toBe(false);
    expect(isFetchableRecipeImageUrl("http://198.18.1.1/secret.jpg")).toBe(false);
    expect(isFetchableRecipeImageUrl("http://224.0.0.1/secret.jpg")).toBe(false);
    expect(isFetchableRecipeImageUrl("http://[::]/secret.jpg")).toBe(false);
    expect(isFetchableRecipeImageUrl("http://[64:ff9b::0a00:1]/secret.jpg")).toBe(false);
    expect(isFetchableRecipeImageUrl("http://[ff02::1]/secret.jpg")).toBe(false);
  });

  it("guesses an extension from the URL or content type", () => {
    expect(imageExtensionFromUrl("https://example.com/photo.webp")).toBe("webp");
    expect(imageExtensionFromUrl("https://example.com/x", "image/png")).toBe("png");
  });

  it("copies remote images through the store and keeps originals on failure", async () => {
    const put = vi.fn(async ({ pathname }: { pathname: string }) =>
      pathname.includes("2.") ? null : `https://blob.example/${pathname}`
    );
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes("fail")) return { ok: false } as Response;
      return {
        ok: true,
        headers: { get: () => "image/jpeg" },
        arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer,
      } as unknown as Response;
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await copyRemoteImages(
      [
        "https://cdn.example/one.jpg",
        "https://cdn.example/fail.jpg",
        "https://abc.public.blob.vercel-storage.com/already.jpg",
      ],
      put,
      "recipes/hh"
    );

    expect(result[0]).toBe("https://blob.example/recipes/hh/1.jpg");
    expect(result[1]).toBe("https://cdn.example/fail.jpg");
    expect(result[2]).toBe("https://abc.public.blob.vercel-storage.com/already.jpg");
    expect(fetchMock).toHaveBeenCalled();
    const blocked = await copyRemoteImages(["http://127.0.0.1/secret.jpg"], put, "recipes/hh");
    expect(blocked).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalledWith("http://127.0.0.1/secret.jpg", expect.anything());
    const firstHeaders = fetchMock.mock.calls[0]?.[1] as { headers?: Record<string, string> };
    expect(firstHeaders.headers?.["User-Agent"]).toMatch(/Mozilla\/5.0/);
    expect(firstHeaders.headers?.Referer).toBe("https://cdn.example/");
    expect(firstHeaders.redirect).toBe("manual");
    vi.unstubAllGlobals();
  });

  it("does not fetch a public hostname that resolves to loopback", async () => {
    vi.mocked(lookup).mockResolvedValueOnce([{ address: "127.0.0.1", family: 4 }] as never);
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const dropped = await copyRemoteImages(
      ["https://loopback.example/photo.jpg"],
      vi.fn(),
      "recipes/hh"
    );
    expect(dropped).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it("does not follow an image redirect onto a private address", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes("cdn.example")) {
        return {
          ok: false,
          status: 302,
          headers: {
            get: (name: string) => (name === "location" ? "http://127.0.0.1/secret.jpg" : null),
          },
        } as unknown as Response;
      }
      return { ok: true, status: 200, headers: { get: () => "image/jpeg" } } as unknown as Response;
    });
    vi.stubGlobal("fetch", fetchMock);
    const dropped = await copyRemoteImages(
      ["https://cdn.example/photo.jpg"],
      vi.fn(),
      "recipes/hh"
    );
    expect(dropped).toEqual([]);
    expect(fetchMock.mock.calls.map((call) => call[0])).toEqual(["https://cdn.example/photo.jpg"]);
    vi.unstubAllGlobals();
  });

  it("drops a URL when the image fetch is refused", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("fetch failed");
      })
    );
    const dropped = await copyRemoteImages(
      ["https://cdn.example/photo.jpg"],
      vi.fn(),
      "recipes/hh"
    );
    expect(dropped).toEqual([]);
    vi.unstubAllGlobals();
  });

  it("builds browser-like image headers and reports when Blob is configured", () => {
    expect(headersForRemoteImage("https://cdn.example/photo.jpg")["User-Agent"]).toMatch(
      /Mozilla\/5.0/
    );
    expect(isBlobStoreConfigured({ BLOB_READ_WRITE_TOKEN: "vercel_blob_rw_x" })).toBe(true);
    expect(isBlobStoreConfigured({})).toBe(false);
  });

  it("detects and parses inline image data URLs", () => {
    expect(isInlineImageDataUrl(dataUrl)).toBe(true);
    expect(isInlineImageDataUrl("https://cdn.example/photo.jpg")).toBe(false);
    const parsed = parseImageDataUrl(dataUrl);
    expect(parsed?.contentType).toBe("image/png");
    expect(parsed?.body.byteLength).toBeGreaterThan(0);
    expect(omitInlineImagePayloads([dataUrl, "https://cdn.example/photo.jpg"])).toEqual([
      "https://cdn.example/photo.jpg",
    ]);
  });

  it("rewrites inline photos to a thumbnail endpoint and never returns bytes", () => {
    const recipeId = "550e8400-e29b-41d4-a716-446655440000";
    expect(publicRecipeImages(recipeId, [dataUrl, "https://ignored.example/b.jpg"])).toEqual([
      recipeImageEndpointPath(recipeId),
    ]);
    expect(publicRecipeImages(recipeId, [dataUrl], { origin: "https://kitchen.example/" })).toEqual(
      [`https://kitchen.example${recipeImageEndpointPath(recipeId)}`]
    );
    expect(presentRecipeImages({ id: recipeId, images: [dataUrl] }).images[0]).not.toMatch(
      /^data:/
    );
    expect(JSON.stringify(presentRecipeImages({ id: recipeId, images: [dataUrl] }))).not.toContain(
      "base64"
    );
    expect(publicRecipeImages(recipeId, ["https://blob.example/main.jpg"])).toEqual([
      "https://blob.example/main.jpg",
    ]);
  });

  it("fingerprints photo imports without returning base64 in preview JSON", () => {
    expect(fingerprintImageBlob("https://cdn.example/card.jpg")).toBe(
      "url:https://cdn.example/card.jpg"
    );
    expect(fingerprintImageBlob(dataUrl)).toMatch(/^sha256:[a-f0-9]{64}$/);
    expect(fingerprintImageBlob(dataUrl)).toBe(fingerprintImageBlob(dataUrl));
    expect(presentPhotoImportImages([dataUrl, "https://blob.example/main.jpg"])).toEqual([
      "https://blob.example/main.jpg",
    ]);
    expect(presentPhotoImportImages([dataUrl])).toEqual([]);
    expect(JSON.stringify(presentPhotoImportImages([dataUrl]))).not.toContain("base64");
  });

  it("uploads inline data URLs when a blob put is available", async () => {
    const put = vi.fn().mockResolvedValue("https://blob.example/stored.png");
    expect(await persistRecipeImageUrl(dataUrl, put, "recipes/hh/photo-import/1")).toBe(
      "https://blob.example/stored.png"
    );
    expect(put).toHaveBeenCalledTimes(1);
    expect(await persistRecipeImageUrl(dataUrl, undefined, "recipes/hh/photo-import/1")).toBe(
      dataUrl
    );

    const backfill = await backfillInlineImageList(
      [dataUrl, "https://cdn.example/keep.jpg"],
      put,
      "recipes/hh/backfill"
    );
    expect(backfill.changed).toBe(true);
    expect(backfill.images).toEqual(["https://blob.example/stored.png"]);
  });

  it("reads the app origin from env for MCP thumbnail URLs", () => {
    expect(appOriginFromEnv({ NEXT_PUBLIC_APP_URL: "https://kitchen.example/" })).toBe(
      "https://kitchen.example"
    );
    expect(appOriginFromEnv({ VERCEL_URL: "ovenlovin.vercel.app" })).toBe(
      "https://ovenlovin.vercel.app"
    );
  });
});
