import { describe, expect, it } from "vitest";
import type { PhotoImportPreview } from "./photo-import";
import {
  isUncertainReviewField,
  recipeCreateBodyFromReview,
  reviewDraftFromPreview,
  uncertainFieldNote,
} from "./photo-import-review";

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
    expect(body.reviewReasons.length).toBeGreaterThan(0);
    expect(body.uncertainFields).toEqual(["title"]);
    expect(body.source.rawExtractionJson.reviewReasons).toEqual(body.reviewReasons);
    expect(body.source.type).toBe("photo");
    expect(body.ingredients).toHaveLength(2);
  });

  it("drops inline data URLs from the create body so Save stays under the 4.5MB cap", () => {
    const draft = reviewDraftFromPreview({
      ...preview,
      images: ["data:image/jpeg;base64,aaaa"],
    });
    expect(recipeCreateBodyFromReview(draft).images).toEqual([]);
  });

  it("highlights title, times, and ingredient fields that were uncertain", () => {
    expect(isUncertainReviewField(["title", "ingredient: pasta"], "title")).toBe(true);
    expect(isUncertainReviewField(["title", "ingredient: pasta"], "ingredients")).toBe(true);
    expect(isUncertainReviewField(["times"], "times")).toBe(true);
    expect(isUncertainReviewField(["title"], "steps")).toBe(false);
  });

  it("names the hard-to-read field next to the box", () => {
    expect(uncertainFieldNote(["title", "ingredient: pasta"], "title")).toBe(
      "This title was hard to read."
    );
    expect(uncertainFieldNote(["title", "ingredient: pasta"], "ingredients")).toBe(
      "pasta was hard to read."
    );
    expect(uncertainFieldNote(["step 2", "step 4"], "steps")).toBe(
      "These steps were hard to read: 2, 4."
    );
    expect(uncertainFieldNote(["title"], "steps")).toBeNull();
  });
});
