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
      "Scaled to 8 for your family"
    );
    await user.click(screen.getByRole("button", { name: "Reset to 4" }));
    expect(screen.getByLabelText("Servings")).toHaveAttribute("aria-valuenow", "4");
    expect(screen.queryByTestId("scaled-servings-note")).not.toBeInTheDocument();
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
    expect(screen.queryByTestId("scaled-servings-note")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /reset to/i })).not.toBeInTheDocument();
  });
});
