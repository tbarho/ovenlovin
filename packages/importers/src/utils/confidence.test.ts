import { describe, it, expect } from "vitest";
import { calculateOverallConfidence, detectMethodTags, extractTimers } from "../utils/confidence";
import type { RecipeDraft } from "../types/importer";

describe("calculateOverallConfidence", () => {
  it("should calculate confidence from ingredients and steps", () => {
    const draft: Omit<RecipeDraft, "overallConfidence" | "needsReview" | "reviewReasons"> = {
      title: "Test Recipe",
      ingredients: [
        { rawText: "1 cup flour", confidence: 0.9 },
        { rawText: "2 eggs", confidence: 0.95 },
      ],
      steps: [{ text: "Mix ingredients", order: 0, confidence: 0.85 }],
      source: {
        type: "paste",
        importerName: "test",
        importerVersion: "1.0.0",
        rawExtractionJson: {},
      },
    };

    const result = calculateOverallConfidence(draft);

    expect(result.overallConfidence).toBeGreaterThan(0.8);
    expect(result.needsReview).toBe(false);
    expect(result.reviewReasons).toHaveLength(0);
  });

  it("should trigger review for low confidence", () => {
    const draft: Omit<RecipeDraft, "overallConfidence" | "needsReview" | "reviewReasons"> = {
      title: "Test Recipe",
      ingredients: [
        {
          rawText: "some flour",
          confidence: 0.3,
          confidenceReasons: ["Missing quantity"],
        },
      ],
      steps: [{ text: "Mix", order: 0, confidence: 0.4 }],
      source: {
        type: "photo",
        importerName: "test",
        importerVersion: "1.0.0",
        rawExtractionJson: {},
      },
    };

    const result = calculateOverallConfidence(draft);

    expect(result.overallConfidence).toBeLessThan(0.6);
    expect(result.needsReview).toBe(true);
    expect(result.reviewReasons.length).toBeGreaterThan(0);
  });

  it("should flag missing title", () => {
    const draft: Omit<RecipeDraft, "overallConfidence" | "needsReview" | "reviewReasons"> = {
      title: "",
      ingredients: [{ rawText: "flour", confidence: 0.9 }],
      steps: [{ text: "Mix", order: 0, confidence: 0.9 }],
      source: {
        type: "paste",
        importerName: "test",
        importerVersion: "1.0.0",
        rawExtractionJson: {},
      },
    };

    const result = calculateOverallConfidence(draft);

    expect(result.needsReview).toBe(true);
    expect(result.reviewReasons).toContain("Missing recipe title");
  });
});

describe("detectMethodTags", () => {
  it("should detect crock pot", () => {
    const tags = detectMethodTags([], ["Add to crock pot and cook for 4 hours"]);
    expect(tags).toContain("crock_pot");
  });

  it("should detect instant pot", () => {
    const tags = detectMethodTags([], ["Cook in instant pot on high pressure"]);
    expect(tags).toContain("instant_pot");
  });

  it("should detect sheet pan", () => {
    const tags = detectMethodTags([], ["Arrange on sheet pan and roast"]);
    expect(tags).toContain("sheet_pan");
  });

  it("should detect grill", () => {
    const tags = detectMethodTags([], ["Grill for 10 minutes"]);
    expect(tags).toContain("grill");
  });

  it("should detect no-cook", () => {
    const tags = detectMethodTags([], ["No cook required, just mix and serve"]);
    expect(tags).toContain("no_cook");
  });

  it("should detect make ahead", () => {
    const tags = detectMethodTags([], ["Can make ahead and refrigerate"]);
    expect(tags).toContain("make_ahead");
  });
});

describe("extractTimers", () => {
  it("should extract single duration", () => {
    const timers = extractTimers("Bake for 30 minutes");
    expect(timers).toHaveLength(1);
    expect(timers[0].duration).toBe(30);
  });

  it("should extract range duration", () => {
    const timers = extractTimers("Cook for 2-3 hours");
    expect(timers).toHaveLength(1);
    expect(timers[0].duration).toBe(150);
  });

  it("should convert hours to minutes", () => {
    const timers = extractTimers("Simmer for 2 hours");
    expect(timers).toHaveLength(1);
    expect(timers[0].duration).toBe(120);
  });

  it("should extract multiple timers", () => {
    const timers = extractTimers("Bake for 20 minutes, then broil for 5 minutes");
    expect(timers).toHaveLength(2);
    expect(timers[0].duration).toBe(20);
    expect(timers[1].duration).toBe(5);
  });
});
