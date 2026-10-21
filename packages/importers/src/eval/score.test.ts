import { describe, expect, it } from "vitest";
import {
  IMPORT_EVAL_SCORE_GATE,
  ingredientMatched,
  median,
  normalizeText,
  scoreRecipe,
} from "./score";

describe("normalizeText", () => {
  it("strips price notes and decodes fractions", () => {
    expect(normalizeText("½ lb. ground beef ($2.50*)")).toBe("1/2 lb ground beef");
  });
});

describe("ingredientMatched", () => {
  it("accepts a faithful full line and the live false-reject lines", () => {
    expect(
      ingredientMatched(
        "1 large can (28 ounces) diced tomatoes, lightly drained",
        "1 large can (28 ounces) diced tomatoes, lightly drained"
      )
    ).toBe(true);
    expect(
      ingredientMatched("1 teaspoon salt, more to taste", "1 teaspoon salt, more to taste")
    ).toBe(true);
    expect(
      ingredientMatched("4 cloves garlic, thinly sliced", "4 cloves garlic, thinly sliced")
    ).toBe(true);
    expect(ingredientMatched("Eggs 2 ea.", "Eggs 2 ea. 100 g 40%")).toBe(true);
    expect(ingredientMatched("Vanilla extract", "Vanilla extract 1 tsp 4.2 g 1.68%")).toBe(true);
    expect(ingredientMatched("1 egg", "1 egg")).toBe(true);
  });

  it("rejects sugar/brown sugar, pepper/bell pepper, and egg/egg noodles", () => {
    expect(ingredientMatched("3/4 cup packed brown sugar", "3/4 cup granulated white sugar")).toBe(
      false
    );
    expect(ingredientMatched("sugar", "3/4 cup packed brown sugar")).toBe(false);
    expect(
      ingredientMatched("85 grams (3 ounces) red bell pepper, diced", "a little black pepper")
    ).toBe(false);
    expect(ingredientMatched("pepper", "85 grams (3 ounces) red bell pepper, diced")).toBe(false);
    expect(ingredientMatched("egg noodles", "1 egg")).toBe(false);
    expect(ingredientMatched("egg", "egg noodles")).toBe(false);
  });
});

describe("scoreRecipe", () => {
  const expected = {
    title: "Weeknight Tomato Pasta",
    servings: 4,
    ingredients: [
      "12 oz pasta",
      "2 tbsp olive oil",
      "3 garlic cloves",
      "1 can crushed tomatoes",
      "basil leaves",
    ],
    stepCount: 3,
    stepMustInclude: ["boil", "garlic", "basil"],
  };

  it("scores a complete extract at 1", () => {
    const scores = scoreRecipe(
      {
        title: "Weeknight Tomato Pasta",
        servings: 4,
        ingredients: [
          "12 oz pasta",
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
  });

  it("penalizes a dropped step and a missed ingredient", () => {
    const scores = scoreRecipe(
      {
        title: "Tomato Pasta",
        servings: 4,
        ingredients: ["12 oz pasta", "2 tbsp olive oil", "1 can tomatoes"],
        steps: ["Boil the pasta.", "Warm the sauce."],
      },
      expected
    );
    expect(scores.title).toBe(0);
    expect(scores.ingredientRecall).toBeLessThan(1);
    expect(scores.stepCompleteness).toBeLessThan(1);
    expect(scores.score).toBeGreaterThan(0.2);
    expect(scores.score).toBeLessThan(0.9);
  });

  it("assigns each key to at most one observed line", () => {
    const scores = scoreRecipe(
      {
        title: "Cookies",
        ingredients: ["3/4 cup packed brown sugar"],
        steps: ["Bake."],
      },
      {
        title: "Cookies",
        servings: null,
        ingredients: ["3/4 cup granulated white sugar", "3/4 cup packed brown sugar"],
        stepCount: 1,
        stepMustInclude: [],
      }
    );
    expect(scores.ingredientRecall).toBe(0.5);
    expect(scores.ingredientPrecision).toBe(1);
  });

  it("does not treat egg as a match for egg noodles", () => {
    const soup = {
      title: "Chicken Noodle Soup",
      servings: 6,
      ingredients: ["2 cups shredded cooked chicken", "2 cups egg noodles", "2 carrots, sliced"],
      stepCount: 2,
      stepMustInclude: ["noodles"],
    };
    const scores = scoreRecipe(
      {
        title: "Chicken Noodle Soup",
        servings: 6,
        ingredients: ["2 cups shredded cooked chicken", "1 egg", "2 carrots, sliced"],
        steps: ["Simmer the chicken.", "Add the egg."],
      },
      soup
    );
    expect(scores.ingredientRecall).toBeLessThan(1);
  });

  it("penalizes extra steps", () => {
    const scores = scoreRecipe(
      {
        title: "Weeknight Tomato Pasta",
        servings: 4,
        ingredients: expected.ingredients,
        steps: ["Boil.", "Garlic.", "Basil.", "Plate leftovers.", "Wash the pot."],
      },
      expected
    );
    expect(scores.stepCompleteness).toBeLessThan(1);
  });

  it("scores a plausibly wrong extract below the eve gate", () => {
    const scores = scoreRecipe(
      {
        title: "Pasta",
        servings: 2,
        ingredients: ["1 egg", "2 tbsp olive oil", "egg noodles"],
        steps: ["Boil water.", "Add noodles.", "Drain.", "Eat.", "Clean up."],
      },
      expected
    );
    expect(scores.score).toBeLessThan(IMPORT_EVAL_SCORE_GATE);
    expect(scores.title).toBe(0);
    expect(scores.ingredientRecall).toBeLessThan(1);
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
      { title: "slow-roasted tomatoes", ingredients: ["1 lb tomatoes"], steps: ["roast"] },
      {
        title: "slow-roasted tomatoes",
        servings: null,
        ingredients: ["1 lb tomatoes"],
        stepCount: 1,
        stepMustInclude: [],
      }
    );
    expect(scores.servings).toBeNull();
    expect(scores.score).toBeCloseTo(
      (scores.title +
        scores.ingredientRecall +
        scores.ingredientPrecision +
        scores.stepCompleteness) /
        4
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
