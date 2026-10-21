import { describe, expect, it } from "vitest";
import {
  draftFromSavedPreview,
  importDedupeKeys,
  preferCompletedImport,
  prepareImportDraft,
} from "./prepare-import-draft";
import { recipeSchema, type RecipeImportDraft } from "../schemas/recipes";

function draft(overrides: Partial<RecipeImportDraft> = {}): RecipeImportDraft {
  return {
    title: "Cookbook: Pancake Recipe",
    ingredients: [{ rawText: "1 cup flour" }],
    steps: [{ text: "Mix." }],
    source: {
      type: "url",
      url: "https://en.wikibooks.org/wiki/Cookbook:Pancake?utm_source=x",
      importerName: "url-importer",
      importerVersion: "0.1.0",
      rawExtractionJson: {},
    },
    needsReview: true,
    ...overrides,
  };
}

describe("prepareImportDraft", () => {
  it("strips Cookbook namespace and fills review reasons", () => {
    const prepared = prepareImportDraft(draft());
    expect(prepared.title).toBe("Pancake");
    expect(prepared.reviewReasons).toEqual([
      "This imported recipe needs a human check before cooking.",
    ]);
    expect(prepared.source.rawExtractionJson.reviewReasons).toEqual(prepared.reviewReasons);
    expect(prepared.source.rawExtractionJson.sourceUrlNormalized).toBe(
      "https://en.wikibooks.org/wiki/Cookbook:Pancake"
    );
  });

  it("builds dedupe keys for idempotency, photo, and URL", () => {
    const prepared = prepareImportDraft(
      draft({
        source: {
          type: "photo",
          importerName: "photo-importer",
          importerVersion: "0.1.0",
          rawExtractionJson: {
            photoFingerprint: "sha256:abc",
            photoPerceptualHash: "aa".repeat(8),
          },
        },
      })
    );
    expect(importDedupeKeys(prepared, "key-1")).toEqual([
      { kind: "idempotency", key: "key-1" },
      { kind: "photo_sha", key: "sha256:abc" },
    ]);
  });

  it("does not treat a manual create with source.url as a URL import lock", () => {
    const prepared = prepareImportDraft(
      draft({
        source: {
          type: "manual",
          url: "https://example.com/already-imported",
          importerName: "rest-create",
          importerVersion: "1",
          rawExtractionJson: {},
        },
      })
    );
    expect(importDedupeKeys(prepared)).toEqual([]);
  });

  it("rounds a 2.5-serving paste so the integer columns save cleanly", () => {
    const prepared = prepareImportDraft(
      draft({
        servings: 2.5,
        prepTimeMinutes: 7.5,
        cookTimeMinutes: 0.4,
        source: {
          type: "paste",
          importerName: "paste-importer",
          importerVersion: "0.1.0",
          rawExtractionJson: {},
        },
      })
    );
    expect(prepared.servings).toBe(3);
    expect(prepared.prepTimeMinutes).toBe(8);
    expect(prepared.cookTimeMinutes).toBe(0);
    expect(
      recipeSchema
        .pick({ servings: true, prepTimeMinutes: true, cookTimeMinutes: true })
        .safeParse({
          servings: prepared.servings,
          prepTimeMinutes: prepared.prepTimeMinutes,
          cookTimeMinutes: prepared.cookTimeMinutes,
        }).success
    ).toBe(true);
  });

  it("rebuilds a recipe draft from a preview payload", () => {
    const preview = presentablePreview();
    const rebuilt = draftFromSavedPreview(preview);
    expect(rebuilt?.title).toBe("Weeknight Tomato Pasta");
    expect(rebuilt?.ingredients).toHaveLength(1);
    expect(rebuilt?.steps).toHaveLength(1);
    expect(rebuilt?.source.importerName).toBe("paste-importer");
    expect(draftFromSavedPreview({ title: "Nope" })).toBeNull();
    expect(draftFromSavedPreview({ ...presentablePreview(), steps: [] })?.steps).toEqual([]);
  });

  it("keeps only typed ingredient fields from a client-sent preview", () => {
    const rebuilt = draftFromSavedPreview({
      ...presentablePreview(),
      ingredients: [
        {
          rawText: "  12 oz pasta  ",
          unit: "oz".repeat(60),
          preparation: "diced".repeat(60),
          quantity: { min: 12, max: 14 },
          confidence: 0.8,
          extra: "drop-me",
        },
      ],
    });
    expect(rebuilt?.ingredients[0]?.rawText).toBe("12 oz pasta");
    expect(rebuilt?.ingredients[0]?.quantity).toEqual({ min: 12, max: 14 });
    expect(rebuilt?.ingredients[0]?.unit).toHaveLength(100);
    expect(rebuilt?.ingredients[0]?.preparation).toHaveLength(255);
    expect(rebuilt?.ingredients[0]?.confidence).toBe(0.8);
    expect(rebuilt?.ingredients[0]).not.toHaveProperty("extra");
  });

  it("drops private image URLs from a client-sent preview", () => {
    const rebuilt = draftFromSavedPreview({
      ...presentablePreview(),
      images: [
        "https://cdn.example/tomato.jpg",
        "http://127.0.0.1/secret.jpg",
        "http://169.254.169.254/latest/meta-data",
      ],
    });
    expect(rebuilt?.images).toEqual(["https://cdn.example/tomato.jpg"]);
  });

  it("replays a completed Idempotency-Key instead of a source_url duplicate", () => {
    const replay = { id: "recipe-replay" };
    const duplicate = { recipe: { id: "recipe-url" }, match: "source_url" as const };
    expect(preferCompletedImport({ idempotency: replay, duplicate })).toEqual({
      recipe: replay,
      match: "idempotency",
    });
    expect(preferCompletedImport({ idempotency: null, duplicate })).toEqual(duplicate);
    expect(preferCompletedImport({ idempotency: null, duplicate: null })).toBeNull();
  });
});

function presentablePreview() {
  return {
    saved: false,
    preview: true,
    title: "Weeknight Tomato Pasta",
    ingredients: [{ rawText: "12 oz pasta" }],
    steps: [{ text: "Boil the pasta." }],
    source: {
      type: "paste",
      importerName: "paste-importer",
      importerVersion: "0.1.0",
      rawExtractionJson: { via: "preview" },
    },
  };
}
