import { describe, expect, it } from "vitest";
import type { PhotoImportPreview } from "./photo-import";
import { recipeCreateBodyFromReview, reviewDraftFromPreview } from "./photo-import-review";

const preview: PhotoImportPreview = {
  title: "Weeknight Tomato Pasta",
  notes: "Salt the pasta water well.",
  servings: 4,
  prepTimeMinutes: 10,
  cookTimeMinutes: 20,
  ingredients: [{ rawText: "12 oz pasta" }, { rawText: "1/2 cup parmesan" }],
  steps: [{ text: "Boil pasta." }, { text: "Toss with sauce." }],
  images: ["https://blob.example/main.jpg", "https://blob.example/extra.jpg"],
  source: {
    type: "photo",
    attribution: "Weeknight Dinners, p. 42",
    importerName: "photo-importer",
    importerVersion: "0.1.0",
    rawExtractionJson: {},
  },
  overallConfidence: 0.4,
  needsReview: true,
  reviewReasons: ["Uncertain fields: title"],
  uncertainFields: ["title"],
  allergenClassifications: [
    {
      ingredientText: "parmesan",
      allergenCode: "milk",
      allergenName: "parmesan",
      relation: "contains",
    },
  ],
};

describe("photo import review draft", () => {
  it("maps preview fields and keeps only the listed image urls for save", () => {
    const draft = reviewDraftFromPreview(preview);
    expect(draft.ingredientsText).toContain("parmesan");
    expect(draft.allergenLabels[0]).toContain("milk");
    const body = recipeCreateBodyFromReview(draft);
    expect(body.images).toEqual(["https://blob.example/main.jpg"]);
    expect(body.status).toBe("needs_review");
    expect(body.source.type).toBe("photo");
    expect(body.ingredients).toHaveLength(2);
  });
});
