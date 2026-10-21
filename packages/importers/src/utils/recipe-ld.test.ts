import { describe, expect, it } from "vitest";
import {
  parseRecipeNotes,
  parseRecipeNutrition,
  parseRecipeServings,
  stripTrailingRecipeWord,
} from "./recipe-ld";

describe("parseRecipeServings", () => {
  it("reads a numeric recipeYield", () => {
    expect(parseRecipeServings({ recipeYield: 6 })).toBe(6);
  });

  it("reads a string like '6 servings'", () => {
    expect(parseRecipeServings({ recipeYield: "6 servings" })).toBe(6);
  });

  it("reads WordPress-style arrays used by Six Sisters / Cozy Cook", () => {
    expect(parseRecipeServings({ recipeYield: ["6 servings"] })).toBe(6);
    expect(parseRecipeServings({ recipeYield: ["6", "6 servings"] })).toBe(6);
  });

  it("reads 'Serves 6' and QuantitativeValue objects", () => {
    expect(parseRecipeServings({ recipeYield: "Serves 6" })).toBe(6);
    expect(
      parseRecipeServings({
        recipeYield: { "@type": "QuantitativeValue", value: 8, unitText: "servings" },
      })
    ).toBe(8);
  });

  it("falls back to yield when recipeYield is missing", () => {
    expect(parseRecipeServings({ yield: "Makes 12" })).toBe(12);
  });

  it("returns undefined when no yield is present", () => {
    expect(parseRecipeServings({})).toBeUndefined();
    expect(parseRecipeServings({ recipeYield: "a few" })).toBeUndefined();
  });

  it("reads N dozen as 12N servings, not N", () => {
    expect(parseRecipeServings({ recipeYield: "3 dozen" })).toBe(36);
    expect(parseRecipeServings({ recipeYield: "5 dozen cookies" })).toBe(60);
    expect(parseRecipeServings({ recipeYield: "Makes 3 dozen" })).toBe(36);
  });
});

describe("parseRecipeNutrition", () => {
  it("parses NutritionInformation quantities from text", () => {
    expect(
      parseRecipeNutrition({
        nutrition: {
          "@type": "NutritionInformation",
          calories: "186 calories",
          proteinContent: "4 g",
          carbohydrateContent: "22 grams",
          fatContent: "9g",
          fiberContent: "2 g",
          sugarContent: "3 g",
          sodiumContent: "210 mg",
        },
      })
    ).toEqual({
      perServing: true,
      calories: 186,
      protein: 4,
      carbohydrates: 22,
      fat: 9,
      fiber: 2,
      sugar: 3,
      sodium: 210,
    });
  });

  it("parses numeric nutrition fields", () => {
    expect(
      parseRecipeNutrition({
        nutrition: { calories: 250, proteinContent: 12 },
      })
    ).toEqual({ perServing: true, calories: 250, protein: 12 });
  });

  it("returns undefined when nutrition is missing or empty", () => {
    expect(parseRecipeNutrition({})).toBeUndefined();
    expect(
      parseRecipeNutrition({ nutrition: { "@type": "NutritionInformation" } })
    ).toBeUndefined();
  });
});

describe("stripTrailingRecipeWord", () => {
  it("strips a trailing Recipe suffix", () => {
    expect(stripTrailingRecipeWord("Spanish Cauliflower Rice Recipe")).toBe(
      "Spanish Cauliflower Rice"
    );
    expect(stripTrailingRecipeWord("Taco Pasta recipe")).toBe("Taco Pasta");
  });

  it("leaves titles that only mention Recipe in the middle", () => {
    expect(stripTrailingRecipeWord("Recipe for Disaster")).toBe("Recipe for Disaster");
  });
});

describe("parseRecipeNotes", () => {
  it("reads notes / recipeNotes / comment", () => {
    expect(parseRecipeNotes({ notes: "Make ahead." })).toBe("Make ahead.");
    expect(parseRecipeNotes({ recipeNotes: ["Chill the dough.", "Freeze extras."] })).toBe(
      "Chill the dough.\nFreeze extras."
    );
    expect(parseRecipeNotes({ comment: "  leftover tip  " })).toBe("leftover tip");
  });
});
