import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { testCookbook, testPerson, testRecipeDetails } from "@/test/fixtures";
import { RecipeDetail } from "./RecipeDetail";

describe("RecipeDetail default servings", () => {
  it("opens a 4-serving recipe at family size and can reset to the card yield", async () => {
    const user = userEvent.setup();
    const people = Array.from({ length: 8 }, (_, index) =>
      testPerson({
        id: `00000000-0000-4000-8000-00000000001${index}`,
        displayName: `Person ${index + 1}`,
      })
    );

    render(
      <RecipeDetail
        recipe={testRecipeDetails({ title: "Weeknight pesto pasta", servings: 4 })}
        cookbooks={[testCookbook()]}
        people={people}
        servingsSettings={{
          mode: "family",
          servings: null,
          familySize: 8,
          defaultCookFor: 8,
        }}
      />
    );

    expect(screen.getByLabelText("Servings")).toHaveAttribute("aria-valuenow", "8");
    expect(screen.getByTestId("scaled-servings-note")).toHaveTextContent(
      "Recipe makes 4 · cooking for 8"
    );
    await user.click(screen.getByRole("button", { name: "Reset to 4" }));
    expect(screen.getByLabelText("Servings")).toHaveAttribute("aria-valuenow", "4");
    expect(screen.getByTestId("scaled-servings-note")).toHaveTextContent("4 servings");
    expect(screen.queryByRole("button", { name: /reset to/i })).not.toBeInTheDocument();
  });

  it("leaves a larger yield alone in family mode", () => {
    render(
      <RecipeDetail
        recipe={testRecipeDetails({ title: "Sunday roast chicken", servings: 10 })}
        cookbooks={[testCookbook()]}
        servingsSettings={{
          mode: "family",
          servings: null,
          familySize: 8,
          defaultCookFor: 8,
        }}
      />
    );

    expect(screen.getByLabelText("Servings")).toHaveAttribute("aria-valuenow", "10");
    expect(screen.getByTestId("scaled-servings-note")).toHaveTextContent("10 servings");
    expect(screen.queryByRole("button", { name: /reset to/i })).not.toBeInTheDocument();
  });

  it("renders schema.org 2/3 decimals as cooking fractions at 1x and when scaled", async () => {
    const user = userEvent.setup();
    render(
      <RecipeDetail
        recipe={testRecipeDetails({
          title: "Tomato soup",
          servings: 4,
          ingredients: [
            {
              id: "00000000-0000-4000-8000-000000000041",
              recipeId: "00000000-0000-4000-8000-000000000030",
              order: 0,
              rawText: "0.6666666667 cup celery",
              quantityMin: 2 / 3,
              unit: "cup",
              isOptional: false,
              createdAt: "2026-01-01T00:00:00.000Z",
              updatedAt: "2026-01-01T00:00:00.000Z",
            },
            {
              id: "00000000-0000-4000-8000-000000000042",
              recipeId: "00000000-0000-4000-8000-000000000030",
              order: 1,
              rawText: "0.6666666667 cup carrot",
              quantityMin: 2 / 3,
              unit: "cup",
              isOptional: false,
              createdAt: "2026-01-01T00:00:00.000Z",
              updatedAt: "2026-01-01T00:00:00.000Z",
            },
          ],
        })}
        cookbooks={[testCookbook()]}
        servingsSettings={{
          mode: "recipe",
          servings: null,
          familySize: 5,
          defaultCookFor: 4,
        }}
      />
    );

    expect(screen.getByText("2/3 cup celery")).toBeInTheDocument();
    expect(screen.getByText("2/3 cup carrot")).toBeInTheDocument();
    expect(screen.queryByText(/0\.666/)).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "More servings" }));
    await user.click(screen.getByRole("button", { name: "More servings" }));
    await user.click(screen.getByRole("button", { name: "More servings" }));
    await user.click(screen.getByRole("button", { name: "More servings" }));
    expect(screen.getByLabelText("Servings")).toHaveAttribute("aria-valuenow", "8");
    expect(screen.getByText("1 1/3 cups celery")).toBeInTheDocument();
    expect(screen.getByText("1 1/3 cups carrot")).toBeInTheDocument();
  });

  it("lets the slider reach a 48-serving recipe yield", () => {
    render(
      <RecipeDetail
        recipe={testRecipeDetails({ title: "Sheet-pan cookies", servings: 48 })}
        cookbooks={[testCookbook()]}
        servingsSettings={{
          mode: "recipe",
          servings: null,
          familySize: 5,
          defaultCookFor: 4,
        }}
      />
    );

    const slider = screen.getByLabelText("Servings");
    expect(slider).toHaveAttribute("aria-valuenow", "48");
    expect(slider).toHaveAttribute("aria-valuemax", "48");
    expect(slider).toHaveAttribute("max", "48");
  });
});
