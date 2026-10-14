import { describe, expect, it } from "vitest";
import { classifyDraftIngredients } from "./classify-allergens";

describe("classifyDraftIngredients", () => {
  it("maps peanut and parmesan through the existing catalog", () => {
    const hits = classifyDraftIngredients([
      { rawText: "1/2 cup roasted peanuts", ingredient: "peanuts", confidence: 0.9 },
      { rawText: "1/2 cup grated parmesan", ingredient: "parmesan", confidence: 0.9 },
      { rawText: "12 oz pasta", ingredient: "pasta", confidence: 0.9 },
    ]);

    expect(hits.some((hit) => hit.allergenCode === "peanut")).toBe(true);
    expect(hits.some((hit) => hit.allergenCode === "milk")).toBe(true);
  });

  it("skips blank lines", () => {
    expect(classifyDraftIngredients([{ rawText: "   ", confidence: 0.2 }])).toEqual([]);
  });
});
