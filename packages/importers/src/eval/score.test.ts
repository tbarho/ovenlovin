import { describe, expect, it } from "vitest";
import { IMPORT_EVAL_SCORE_GATE, median, normalizeText, scoreRecipe } from "./score";

describe("normalizeText", () => {
  it("strips price notes and decodes fractions", () => {
    expect(normalizeText("½ lb. ground beef ($2.50*)")).toBe("1/2 lb ground beef");
  });
});

describe("scoreRecipe", () => {
  const expected = {
    title: "Weeknight Tomato Pasta",
    servings: 4,
    ingredients: ["pasta", "olive oil", "garlic", "crushed tomatoes", "basil"],
    stepCount: 3,
    stepMustInclude: ["boil", "garlic", "basil"],
  };

  it("scores a complete extract at 1", () => {
    const scores = scoreRecipe(
      {
        title: "Weeknight Tomato Pasta",
        servings: 4,
        ingredients: [
          "12 oz dried pasta",
          "2 tbsp olive oil",
          "3 garlic cloves",
          "1 can crushed tomatoes",
          "basil leaves",
        ],
        steps: [
          "Boil the pasta in salted water.",
          "Warm the oil and garlic, then add tomatoes.",
          "Toss with basil.",
        ],
      },
      expected
    );
    expect(scores.score).toBe(1);
    expect(scores.validStructured).toBe(1);
  });

  it("penalizes a dropped step and a missed ingredient", () => {
    const scores = scoreRecipe(
      {
        title: "Tomato Pasta",
        servings: 4,
        ingredients: ["pasta", "olive oil", "tomatoes"],
        steps: ["Boil the pasta.", "Warm the sauce."],
      },
      expected
    );
    expect(scores.ingredientRecall).toBeLessThan(1);
    expect(scores.stepCompleteness).toBeLessThan(1);
    expect(scores.score).toBeGreaterThan(0.4);
    expect(scores.score).toBeLessThan(0.9);
  });

  it("accepts either pot-pie serving reading", () => {
    const potPie = { ...expected, title: "Chicken Pot Pie", servings: [8, 16] };
    expect(
      scoreRecipe({ title: "Chicken Pot Pie", servings: 16, ingredients: [], steps: [] }, potPie)
        .servings
    ).toBe(1);
    expect(
      scoreRecipe({ title: "Chicken Pot Pie", servings: 8, ingredients: [], steps: [] }, potPie)
        .servings
    ).toBe(1);
    expect(
      scoreRecipe({ title: "Chicken Pot Pie", servings: 2, ingredients: [], steps: [] }, potPie)
        .servings
    ).toBe(0);
  });

  it("does not give a free servings point when the gold has none", () => {
    const scores = scoreRecipe(
      { title: "slow-roasted tomatoes", ingredients: ["tomatoes", "garlic"], steps: ["roast"] },
      {
        title: "slow-roasted tomatoes",
        servings: null,
        ingredients: ["tomatoes"],
        stepCount: 1,
        stepMustInclude: [],
      }
    );
    expect(scores.servings).toBe(0);
    expect(scores.score).toBeCloseTo(
      (scores.title +
        scores.ingredientRecall +
        scores.ingredientPrecision +
        scores.stepCompleteness +
        scores.validStructured) /
        5
    );
  });

  it("scores a blank extract below the eve gate", () => {
    const scores = scoreRecipe({ ingredients: [], steps: [] }, expected);
    expect(scores.score).toBeLessThan(IMPORT_EVAL_SCORE_GATE);
    expect(scores.score).toBe(0);
  });
});

describe("median", () => {
  it("returns the middle value", () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1])).toBe(2.5);
  });
});
