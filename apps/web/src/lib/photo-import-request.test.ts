import { describe, expect, it } from "vitest";
import { BadRequestError } from "@/lib/api/errors";
import { readPhotoImportRequest } from "./photo-import-request";

const png =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

describe("readPhotoImportRequest", () => {
  it("reads a JSON blob URL for preview", async () => {
    const request = new Request("http://localhost/api/v1/recipes/import/photo", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        imageUrl: "https://blob.vercel-storage.com/card.jpg",
        isHandwritten: true,
      }),
    });

    const parsed = await readPhotoImportRequest(request);
    expect(parsed.save).toBe(false);
    expect(parsed.allowDuplicate).toBe(false);
    expect(parsed.isHandwritten).toBe(true);
    expect(parsed.images).toEqual([{ blob: "https://blob.vercel-storage.com/card.jpg" }]);
  });

  it("reads multipart files plus save", async () => {
    const bytes = Buffer.from(png, "base64");
    const form = new FormData();
    form.append("image", new File([bytes], "card.png", { type: "image/png" }));
    form.append("save", "true");
    form.append("allowDuplicate", "true");
    form.append("isHandwritten", "1");

    const request = new Request("http://localhost/api/v1/recipes/import/photo", {
      method: "POST",
      body: form,
    });

    const parsed = await readPhotoImportRequest(request);
    expect(parsed.save).toBe(true);
    expect(parsed.allowDuplicate).toBe(true);
    expect(parsed.isHandwritten).toBe(true);
    expect(parsed.images).toHaveLength(1);
    expect(parsed.images[0]?.blob).toMatch(/^data:image\/png;base64,/);
  });

  it("persists when JSON save is the number 1", async () => {
    const request = new Request("http://localhost/api/v1/recipes/import/photo", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        imageUrl: "https://blob.vercel-storage.com/card.jpg",
        save: 1,
      }),
    });

    const parsed = await readPhotoImportRequest(request);
    expect(parsed.save).toBe(true);
  });

  it("does not persist when JSON save is the string false", async () => {
    const request = new Request("http://localhost/api/v1/recipes/import/photo", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        imageUrl: "https://blob.vercel-storage.com/card.jpg",
        save: "false",
      }),
    });

    const parsed = await readPhotoImportRequest(request);
    expect(parsed.save).toBe(false);
  });

  it("does not allow duplicates when JSON allowDuplicate is the string false", async () => {
    const request = new Request("http://localhost/api/v1/recipes/import/photo", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        imageUrl: "https://blob.vercel-storage.com/card.jpg",
        allowDuplicate: "false",
      }),
    });

    const parsed = await readPhotoImportRequest(request);
    expect(parsed.allowDuplicate).toBe(false);
  });

  it("accepts a previewed draft without sending the photo again", async () => {
    const request = new Request("http://localhost/api/v1/recipes/import/photo", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        save: true,
        draft: {
          title: "Weeknight Tomato Pasta",
          ingredients: [{ rawText: "12 oz pasta" }],
          steps: [{ text: "Boil the pasta." }],
          source: {
            type: "photo",
            importerName: "photo-importer",
            importerVersion: "0.1.0",
            rawExtractionJson: {},
          },
        },
      }),
    });

    const parsed = await readPhotoImportRequest(request);
    expect(parsed.save).toBe(true);
    expect(parsed.images).toEqual([]);
    expect(parsed.draft).toMatchObject({ title: "Weeknight Tomato Pasta" });
  });

  it("accepts a public image URL without a file extension", async () => {
    const request = new Request("http://localhost/api/v1/recipes/import/photo", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ imageUrl: "https://images.unsplash.com/photo-abc" }),
    });

    const parsed = await readPhotoImportRequest(request);
    expect(parsed.images).toEqual([{ blob: "https://images.unsplash.com/photo-abc" }]);
  });

  it("rejects a private photo URL before fetch", async () => {
    const request = new Request("http://localhost/api/v1/recipes/import/photo", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ imageUrl: "http://127.0.0.1/card.png" }),
    });

    await expect(readPhotoImportRequest(request)).rejects.toMatchObject({
      name: "InvalidImageUrlError",
      code: "invalid_image_url",
    });
  });

  it("rejects an empty body", async () => {
    const request = new Request("http://localhost/api/v1/recipes/import/photo", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    });

    await expect(readPhotoImportRequest(request)).rejects.toBeInstanceOf(BadRequestError);
  });
});
