import { describe, expect, it, vi } from "vitest";
import {
  copyRemoteImages,
  imageExtensionFromUrl,
  isStoredBlobUrl,
  recipeGalleryImages,
  recipeMainImage,
} from "./recipe-images";

describe("recipe images", () => {
  it("picks the first non-empty image as the main photo", () => {
    expect(recipeMainImage(["", "https://example.com/a.jpg"])).toBe("https://example.com/a.jpg");
    expect(recipeGalleryImages(["https://a", "", "https://b"])).toEqual(["https://a", "https://b"]);
  });

  it("recognizes Vercel Blob URLs", () => {
    expect(isStoredBlobUrl("https://abc.public.blob.vercel-storage.com/cookies.jpg")).toBe(true);
    expect(isStoredBlobUrl("https://example.com/cookies.jpg")).toBe(false);
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
    vi.unstubAllGlobals();
  });
});
