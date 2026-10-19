import { describe, expect, it } from "vitest";
import { ensureReviewMetadata } from "./import-review";

describe("ensureReviewMetadata", () => {
  it("fills reviewReasons when needs_review has none", () => {
    const result = ensureReviewMetadata({
      needsReview: true,
      uncertainFields: ["title", "servings"],
      rawExtractionJson: {},
    });
    expect(result.reviewReasons).toEqual(["Uncertain fields: title, servings"]);
    expect(result.uncertainFields).toEqual(["title", "servings"]);
    expect(result.rawExtractionJson.reviewReasons).toEqual(result.reviewReasons);
  });

  it("keeps an explicit reason", () => {
    const result = ensureReviewMetadata({
      needsReview: true,
      reviewReasons: ["Handwritten recipe card - verify OCR accuracy"],
      uncertainFields: ["title"],
    });
    expect(result.reviewReasons).toEqual(["Handwritten recipe card - verify OCR accuracy"]);
  });
});
