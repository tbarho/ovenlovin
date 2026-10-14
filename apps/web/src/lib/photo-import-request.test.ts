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
    expect(parsed.isHandwritten).toBe(true);
    expect(parsed.images).toEqual([{ blob: "https://blob.vercel-storage.com/card.jpg" }]);
  });

  it("reads multipart files plus save", async () => {
    const bytes = Buffer.from(png, "base64");
    const form = new FormData();
    form.append("image", new File([bytes], "card.png", { type: "image/png" }));
    form.append("save", "true");
    form.append("isHandwritten", "1");

    const request = new Request("http://localhost/api/v1/recipes/import/photo", {
      method: "POST",
      body: form,
    });

    const parsed = await readPhotoImportRequest(request);
    expect(parsed.save).toBe(true);
    expect(parsed.isHandwritten).toBe(true);
    expect(parsed.images).toHaveLength(1);
    expect(parsed.images[0]?.blob).toMatch(/^data:image\/png;base64,/);
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
