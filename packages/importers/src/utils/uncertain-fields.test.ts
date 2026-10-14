import { describe, expect, it } from "vitest";
import { listUncertainFields } from "./uncertain-fields";

const base = {
  title: "Tomato pasta",
  servings: 4,
  prepTimeMinutes: 10,
  cookTimeMinutes: 20,
  ingredients: [{ rawText: "12 oz pasta", ingredient: "pasta", confidence: 0.9 }],
  steps: [{ text: "Boil pasta.", order: 0, confidence: 0.9 }],
};

describe("listUncertainFields", () => {
  it("returns nothing for a complete high-confidence draft", () => {
    expect(listUncertainFields(base)).toEqual([]);
  });

  it("lists missing title, servings, and times", () => {
    expect(
      listUncertainFields({
        title: "",
        ingredients: base.ingredients,
        steps: base.steps,
      })
    ).toEqual(["title", "servings", "times"]);
  });

  it("names low-confidence ingredients and steps", () => {
    expect(
      listUncertainFields({
        ...base,
        ingredients: [
          { rawText: "2 tsp baking soda", ingredient: "baking soda", confidence: 0.4 },
          { rawText: "1 cup sugar", ingredient: "sugar", confidence: 0.9 },
        ],
        steps: [
          { text: "Mix well.", order: 0, confidence: 0.9 },
          { text: "Bake 10-12 min.", order: 1, confidence: 0.3 },
        ],
      })
    ).toEqual(["ingredient: baking soda", "step 2"]);
  });

  it("flags low field-level OCR confidence even when a value exists", () => {
    expect(
      listUncertainFields(base, {
        titleConfidence: "low",
        servingsConfidence: "illegible",
        timesConfidence: "low",
      })
    ).toEqual(["title", "servings", "times"]);
  });
});
