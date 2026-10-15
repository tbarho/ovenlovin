import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { householdLovePeople } from "@/lib/household-loves";
import { recipeSafetySummary } from "@/lib/recipe-card-safety";
import {
  testCookbook,
  testPerson,
  testPersonRule,
  testPreference,
  testRecipe,
  testRecipeDetails,
} from "@/test/fixtures";
import { RecipeDetail } from "./RecipeDetail";
import { RecipesKitchen } from "./RecipesKitchen";

const childC = testPerson({
  id: "00000000-0000-4000-8000-000000000013",
  displayName: "Child C",
});
const treeNut = testPersonRule({
  personId: childC.id,
  target: "tree_nut",
  severity: "block",
  sharedFacility: "block",
  includeCrossContact: true,
  includeMayContain: true,
  includeDescendants: true,
});
const pastaLove = householdLovePeople(
  [childC],
  [testPreference({ personId: childC.id, type: "love", value: "pasta" })]
);

describe("RecipeCardSafety", () => {
  it("overrides Child C loves this on a pesto pasta card with the pine-nut warning", () => {
    const recipe = testRecipe({ title: "Weeknight pesto pasta" });
    const safety = recipeSafetySummary({
      people: [childC],
      rules: [treeNut],
      ingredients: [{ id: "pesto", name: "1/3 cup basil pesto" }],
    });

    render(
      <RecipesKitchen
        cookbooks={[]}
        uncategorized={[recipe]}
        recipes={[recipe]}
        lovePeople={pastaLove}
        safetyByRecipe={{ [recipe.id]: safety }}
      />
    );

    expect(screen.queryByText("Child C loves this")).not.toBeInTheDocument();
    expect(screen.queryByText(/loves this - check first/)).not.toBeInTheDocument();
    expect(screen.getByTestId("recipe-card-warnings")).toHaveTextContent(/pine nuts/i);
    expect(screen.getByTestId("recipe-card-warnings")).toHaveTextContent(/Child C can't eat this/);
  });

  it("does not soften a can't-eat conflict to check first on the recipe page", () => {
    render(
      <RecipeDetail
        recipe={testRecipeDetails({
          title: "Weeknight pesto pasta",
          ingredients: [
            {
              id: "00000000-0000-4000-8000-000000000031",
              recipeId: "00000000-0000-4000-8000-000000000030",
              order: 0,
              rawText: "1/3 cup basil pesto",
              isOptional: false,
              createdAt: "2026-01-01T00:00:00.000Z",
              updatedAt: "2026-01-01T00:00:00.000Z",
            },
          ],
        })}
        cookbooks={[testCookbook()]}
        people={[childC]}
        rules={[treeNut]}
        lovePeople={pastaLove}
      />
    );

    expect(screen.queryByText("Child C loves this")).not.toBeInTheDocument();
    expect(screen.queryByText(/loves this - check first/)).not.toBeInTheDocument();
    expect(screen.getByText("Can't eat")).toBeVisible();
  });
});
