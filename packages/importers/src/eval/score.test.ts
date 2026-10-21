import { describe, expect, it } from "vitest";
import {
  IMPORT_EVAL_SCORE_GATE,
  ingredientMatched,
  median,
  normalizeText,
  scoreRecipe,
  type ExpectedRecipe,
} from "./score";

const tomato: ExpectedRecipe = {
  title: "Weeknight Tomato Pasta",
  servings: 4,
  acceptServings: [4],
  ingredients: [
    { line: "12 oz pasta", food: "pasta" },
    { line: "2 tbsp olive oil", food: "olive oil" },
    { line: "3 garlic cloves", food: "garlic" },
    { line: "1 can crushed tomatoes", food: "crushed tomatoes" },
    { line: "basil leaves", food: "basil" },
  ],
  stepCount: 3,
  acceptStepCounts: [3],
};

describe("normalizeText", () => {
  it("strips price notes and decodes fractions", () => {
    expect(normalizeText("½ lb. ground beef ($2.50*)")).toBe("1/2 lb ground beef");
  });
});

describe("ingredientMatched", () => {
  it("finds a one-word food in a full line", () => {
    expect(ingredientMatched("1 tsp salt", "salt")).toBe(true);
    expect(ingredientMatched("- 1 tsp salt", "salt")).toBe(true);
    expect(ingredientMatched("1 egg", "egg")).toBe(true);
  });

  it("finds a food through unit abbreviations and hyphenated quantities", () => {
    expect(ingredientMatched("3/4 c. shortening", "shortening")).toBe(true);
    expect(ingredientMatched("1-3/4 cups sliced carrots", "carrots")).toBe(true);
    expect(ingredientMatched("Eggs 2 ea. 100 g 40%", "eggs")).toBe(true);
  });

  it("allows words between food tokens", () => {
    expect(ingredientMatched("3/4 cup (180 ml) granulated white sugar", "granulated sugar")).toBe(
      true
    );
    expect(
      ingredientMatched(
        "2 cups (480 ml / 12 oz) semi-sweet chocolate morsels / chips",
        "chocolate chips"
      )
    ).toBe(true);
  });

  it("rejects a different modified food", () => {
    expect(ingredientMatched("3/4 cup packed brown sugar", "sugar")).toBe(false);
    expect(ingredientMatched("1 cup brown sugar", "sugar")).toBe(false);
    expect(ingredientMatched("2 cups egg noodles", "egg")).toBe(false);
    expect(ingredientMatched("8 cups chicken broth", "chicken")).toBe(false);
    expect(ingredientMatched("85 grams (3 ounces) red bell pepper, diced", "pepper")).toBe(false);
  });

  it("still matches the compound food itself and an unmodified short food", () => {
    expect(ingredientMatched("3/4 cup packed brown sugar", "brown sugar")).toBe(true);
    expect(ingredientMatched("3/4 cup sugar", "sugar")).toBe(true);
    expect(ingredientMatched("White sugar 1 cup 200 g 80%", "sugar")).toBe(true);
    expect(ingredientMatched("1 cup brown or green lentils, rinsed", "lentils")).toBe(true);
    expect(ingredientMatched("2 cups shredded cooked chicken", "chicken")).toBe(true);
  });
});

describe("scoreRecipe", () => {
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
      tomato
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
      tomato
    );
    expect(scores.title).toBe(0);
    expect(scores.ingredientRecall).toBeLessThan(1);
    expect(scores.stepCompleteness).toBeLessThan(1);
    expect(scores.score).toBeLessThan(IMPORT_EVAL_SCORE_GATE);
  });

  it("assigns the longest food first so brown sugar does not cover sugar", () => {
    const scores = scoreRecipe(
      {
        title: "Cookies",
        ingredients: ["3/4 cup packed brown sugar"],
        steps: ["Bake."],
      },
      {
        title: "Cookies",
        servings: null,
        acceptServings: [],
        ingredients: [
          { line: "3/4 cup granulated white sugar", food: "sugar" },
          { line: "3/4 cup packed brown sugar", food: "brown sugar" },
        ],
        stepCount: 1,
        acceptStepCounts: [1],
      }
    );
    expect(scores.ingredientRecall).toBe(0.5);
    expect(scores.ingredientPrecision).toBe(1);
  });

  it("does not treat egg as a match for egg noodles", () => {
    const soup: ExpectedRecipe = {
      title: "Chicken Noodle Soup",
      servings: 6,
      ingredients: [
        { line: "2 cups shredded cooked chicken", food: "chicken" },
        { line: "2 cups egg noodles", food: "egg noodles" },
        { line: "2 carrots, sliced", food: "carrots" },
      ],
      stepCount: 2,
      acceptStepCounts: [2],
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
        ingredients: tomato.ingredients.map((item) => item.line),
        steps: ["Boil.", "Garlic.", "Basil.", "Plate leftovers.", "Wash the pot."],
      },
      tomato
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
      tomato
    );
    expect(scores.score).toBeLessThan(IMPORT_EVAL_SCORE_GATE);
    expect(scores.title).toBe(0);
    expect(scores.ingredientRecall).toBeLessThan(1);
  });

  it("accepts either pot-pie serving reading", () => {
    const potPie = { ...tomato, title: "Chicken Pot Pie", acceptServings: [8, 16] };
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
        acceptServings: [],
        ingredients: [{ line: "1 lb tomatoes", food: "tomatoes" }],
        stepCount: 1,
        acceptStepCounts: [1],
      }
    );
    expect(scores.servings).toBeNull();
    expect(scores.score).toBe(1);
  });

  it("scores a blank extract below the eve gate", () => {
    const scores = scoreRecipe({ ingredients: [], steps: [] }, tomato);
    expect(scores.score).toBeLessThan(IMPORT_EVAL_SCORE_GATE);
    expect(scores.score).toBe(0);
  });

  it("accepts a title alias", () => {
    const scores = scoreRecipe(
      {
        title: "Ginger Snaps",
        servings: 48,
        ingredients: tomato.ingredients.map((item) => item.line),
        steps: ["a", "b", "c"],
      },
      { ...tomato, title: "Grandma's Ginger Snaps", titleAliases: ["Ginger Snaps"] }
    );
    expect(scores.title).toBe(1);
  });
});

describe("median", () => {
  it("returns the middle value", () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1])).toBe(2.5);
  });
});
