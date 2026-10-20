import { describe, expect, it } from "vitest";
import { presentRecipeForKitchen } from "./kitchen-servings";
import { testRecipeDetails } from "@/test/fixtures";

describe("presentRecipeForKitchen", () => {
  it("applies family Default servings and honors a servings query override", () => {
    const recipe = testRecipeDetails({
      title: "Weeknight pesto pasta",
      servings: 4,
      ingredients: [
        {
          id: "00000000-0000-4000-8000-000000000041",
          recipeId: "00000000-0000-4000-8000-000000000030",
          order: 0,
          rawText: "1 lb pasta",
          quantityMin: 1,
          unit: "lb",
          isOptional: false,
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z",
        },
      ],
    });

    const family = presentRecipeForKitchen(recipe, {
      mode: "family",
      servings: null,
      familySize: 8,
      defaultCookFor: 8,
    });
    expect(family.displayServings).toBe(8);
    expect(family.servings).toBe(4);
    expect(family.ingredients[0]?.displayText).toBe("2 lbs pasta");

    const overridden = presentRecipeForKitchen(
      recipe,
      { mode: "family", servings: null, familySize: 8, defaultCookFor: 8 },
      "6"
    );
    expect(overridden.displayServings).toBe(6);
    expect(overridden.ingredients[0]?.displayText).toBe("1 1/2 lbs pasta");
  });
});
