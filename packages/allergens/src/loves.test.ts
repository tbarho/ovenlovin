import { describe, expect, it } from "vitest";
import {
  loveLabel,
  loveScore,
  loveTag,
  lovesForRecipe,
  rankRecipesByLoves,
  recipeMatchesLove,
} from "./loves";

const ty = {
  personId: "ty",
  personName: "Ty",
  preference: { id: "p1", personId: "ty", value: "salmon", weight: 1, type: "love" },
};
const spicy = {
  personId: "ty",
  personName: "Ty",
  preference: { id: "p2", personId: "ty", value: "spicy", weight: 1, type: "love" },
};
const mexican = {
  personId: "ty",
  personName: "Ty",
  preference: { id: "p3", personId: "ty", value: "mexican", weight: 2, type: "love" },
};

describe("loves ranking", () => {
  it("never treats a miss as a filter - unmatched recipes stay in the list", () => {
    const recipes = [
      {
        title: "Tomato soup",
        cuisine: "American",
        ingredients: [{ rawText: "2 cans crushed tomatoes" }],
      },
      {
        title: "Sheet-pan salmon",
        cuisine: "American",
        ingredients: [{ rawText: "4 salmon fillets" }],
      },
    ];
    const ranked = rankRecipesByLoves(recipes, [ty]);
    expect(ranked.map((recipe) => recipe.title)).toEqual(["Sheet-pan salmon", "Tomato soup"]);
    expect(ranked).toHaveLength(2);
  });

  it("matches cuisine, style, and ingredient lines", () => {
    expect(
      recipeMatchesLove(
        { title: "Veggie tacos", cuisine: "Mexican", ingredients: [{ rawText: "8 corn tortillas" }] },
        "mexican"
      )
    ).toBe(true);
    expect(
      recipeMatchesLove(
        {
          title: "Kung pao chicken",
          description: "spicy stir-fry",
          ingredients: [{ rawText: "1 lb chicken" }],
        },
        "spicy"
      )
    ).toBe(true);
    expect(
      recipeMatchesLove(
        { title: "Sheet-pan salmon", ingredients: [{ rawText: "4 salmon fillets" }] },
        "salmon"
      )
    ).toBe(true);
  });

  it("never tags a recipe that has no ingredients", () => {
    const empty = { title: "Weeknight pesto pasta", cuisine: "Italian" };
    expect(recipeMatchesLove(empty, "pasta")).toBe(false);
    expect(lovesForRecipe(empty, [mexican])).toEqual([]);
    expect(loveScore(empty, [mexican])).toBe(0);
  });

  it("uses the Loves catalog name when a dislike shares the code", () => {
    expect(loveLabel("spicy")).toBe("Spicy");
    expect(loveLabel("mexican")).toBe("Mexican");
    expect(loveLabel("durian")).toBe("Durian");
  });

  it("builds a small tag and scores by weight", () => {
    const tacos = {
      title: "Veggie tacos",
      cuisine: "Mexican",
      ingredients: [{ rawText: "8 corn tortillas" }],
    };
    expect(loveTag("Ty")).toBe("Ty loves this");
    expect(lovesForRecipe(tacos, [mexican])[0]?.tag).toBe("Ty loves this");
    expect(loveScore(tacos, [mexican, spicy])).toBe(2);
  });
});
