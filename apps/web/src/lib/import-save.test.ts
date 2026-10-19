import { describe, expect, it } from "vitest";
import {
  countsAsDemoImport,
  importDuplicateDetail,
  presentImportPreview,
  wantsPersist,
} from "./import-save";

describe("import save helpers", () => {
  it("previews unless save is true", () => {
    expect(wantsPersist(undefined)).toBe(false);
    expect(wantsPersist(false)).toBe(false);
    expect(wantsPersist("false")).toBe(false);
    expect(wantsPersist(true)).toBe(true);
    expect(wantsPersist("true")).toBe(true);
  });

  it("names the existing recipe on a near-duplicate photo", () => {
    expect(importDuplicateDetail("photo_near", "Weeknight Tomato Pasta")).toContain(
      "Weeknight Tomato Pasta"
    );
    expect(importDuplicateDetail("photo_near", "Weeknight Tomato Pasta")).toContain(
      "nearly identical"
    );
  });

  it("counts only url, photo, and paste sources as demo imports", () => {
    expect(countsAsDemoImport("photo")).toBe(true);
    expect(countsAsDemoImport("url")).toBe(true);
    expect(countsAsDemoImport("manual")).toBe(false);
  });

  it("returns review fields on a URL preview", () => {
    const preview = presentImportPreview({
      title: "Pancake",
      ingredients: [{ rawText: "1 cup flour" }],
      steps: [{ text: "Mix." }],
      needsReview: true,
      reviewReasons: ["This imported recipe needs a human check before cooking."],
      uncertainFields: ["servings"],
      source: {
        type: "url",
        importerName: "url-importer",
        importerVersion: "0.1.0",
        rawExtractionJson: {},
      },
    });
    expect(preview.reviewReasons).toHaveLength(1);
    expect(preview.uncertainFields).toEqual(["servings"]);
  });
});
