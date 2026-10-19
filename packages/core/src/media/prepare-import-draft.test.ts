import { describe, expect, it } from "vitest";
import { importDedupeKeys, prepareImportDraft } from "./prepare-import-draft";
import type { RecipeImportDraft } from "../schemas/recipes";

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
});
