import { describe, expect, it, vi } from "vitest";
import {
  asImageDataUrl,
  collectPhotoImages,
  draftFromPhotoPreview,
  parseDataUrl,
  persistMainPhoto,
  presentPhotoImportPreview,
  previewFromDraft,
} from "./photo-import";
import type { RecipeDraft } from "@ovenlovin/importers";

const png =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

function draft(overrides: Partial<RecipeDraft> = {}): RecipeDraft {
  return {
    title: "Weeknight Tomato Pasta",
    notes: "Salt the pasta water well.",
    servings: 4,
    prepTimeMinutes: 10,
    cookTimeMinutes: 20,
    ingredients: [
      {
        rawText: "1/2 cup grated parmesan",
        ingredient: "parmesan",
        quantity: { min: 0.5 },
        unit: "cup",
        confidence: 0.9,
      },
    ],
    steps: [{ text: "Toss pasta with sauce.", order: 0, confidence: 0.9 }],
    source: {
      type: "photo",
      attribution: "Weeknight Dinners, p. 42",
      importerName: "photo-importer",
      importerVersion: "0.1.0",
      rawExtractionJson: { via: "test" },
    },
    overallConfidence: 0.88,
    needsReview: true,
    reviewReasons: [],
    uncertainFields: [],
    allergenClassifications: [
      {
        ingredientText: "parmesan",
        allergenCode: "milk",
        allergenName: "parmesan",
        relation: "contains",
      },
    ],
    ...overrides,
  };
}

describe("collectPhotoImages", () => {
  it("accepts a blob URL, extra page URLs, and base64", () => {
    const images = collectPhotoImages({
      imageUrl: "https://blob.vercel-storage.com/card.jpg",
      imageUrls: ["https://example.com/page-2.jpg"],
      imageBase64: png,
      mimeType: "image/png",
    });
    expect(images).toHaveLength(3);
    expect(images[0]?.blob).toContain("blob.vercel-storage.com");
    expect(images[2]?.blob).toMatch(/^data:image\/png;base64,/);
  });

  it("accepts an images array of urls or base64", () => {
    const images = collectPhotoImages({
      images: [{ url: "https://example.com/a.jpg" }, { base64: png, mimeType: "image/png" }],
    });
    expect(images.map((image) => image.blob)).toEqual([
      "https://example.com/a.jpg",
      `data:image/png;base64,${png}`,
    ]);
  });
});

describe("asImageDataUrl / parseDataUrl", () => {
  it("wraps raw base64 and parses it back", () => {
    const dataUrl = asImageDataUrl(png, "image/png");
    const parsed = parseDataUrl(dataUrl);
    expect(parsed.contentType).toBe("image/png");
    expect(parsed.body.byteLength).toBeGreaterThan(0);
  });

  it("leaves an existing data URL alone", () => {
    const dataUrl = `data:image/jpeg;base64,${png}`;
    expect(asImageDataUrl(dataUrl)).toBe(dataUrl);
  });
});

describe("preview and save draft", () => {
  it("keeps a single main image and allergen hits", () => {
    const preview = previewFromDraft(draft(), [
      "https://blob.vercel-storage.com/main.jpg",
      "https://blob.vercel-storage.com/extra.jpg",
    ]);
    expect(preview.images).toEqual(["https://blob.vercel-storage.com/main.jpg"]);
    expect(preview.notes).toBe("Salt the pasta water well.");
    expect(preview.allergenClassifications[0]?.allergenCode).toBe("milk");
    expect(preview.uncertainFields).toEqual([]);

    expect(preview.source.blobRefs).toEqual(["https://blob.vercel-storage.com/main.jpg"]);

    const saved = draftFromPhotoPreview(preview);
    expect(saved.images).toEqual(["https://blob.vercel-storage.com/main.jpg"]);
    expect(saved.source.blobRefs).not.toEqual(
      expect.arrayContaining([expect.stringMatching(/^data:/)])
    );
    expect(saved.source.type).toBe("photo");
    expect(saved.ingredients[0]?.quantity).toEqual({ min: 0.5 });
    expect(saved.needsReview).toBe(true);
  });

  it("does not copy inline photo bytes into source.blobRefs", () => {
    const data = `data:image/png;base64,${png}`;
    const preview = previewFromDraft(
      draft({
        source: {
          type: "photo",
          importerName: "photo-importer",
          importerVersion: "0.1.0",
          rawExtractionJson: { via: "test" },
          blobRefs: [data],
        },
      }),
      [data]
    );
    expect(preview.images).toEqual([data]);
    expect(preview.source.blobRefs ?? []).toEqual([]);
    const presented = presentPhotoImportPreview(preview);
    expect(presented.images).toEqual([]);
    expect(JSON.stringify(presented)).not.toContain("base64");
  });

  it("marks needsReview when uncertain fields are listed", () => {
    const preview = previewFromDraft(
      draft({ uncertainFields: ["title", "ingredient: flour"] }),
      []
    );
    expect(draftFromPhotoPreview(preview).needsReview).toBe(true);
  });
});

describe("persistMainPhoto", () => {
  it("uploads a data URL through the blob put and keeps only the main image", async () => {
    const put = vi.fn().mockResolvedValue("https://blob.vercel-storage.com/stored.png");
    const stored = await persistMainPhoto(
      [{ blob: asImageDataUrl(png, "image/png") }, { blob: "https://example.com/page-2.jpg" }],
      "household-1",
      put
    );
    expect(put).toHaveBeenCalledTimes(1);
    expect(stored).toEqual(["https://blob.vercel-storage.com/stored.png"]);
  });

  it("keeps the data URL in storage when Blob is not configured", async () => {
    const stored = await persistMainPhoto(
      [{ blob: asImageDataUrl(png, "image/png") }],
      "household-1",
      undefined
    );
    expect(stored[0]).toMatch(/^data:image\/png;base64,/);
  });
});
