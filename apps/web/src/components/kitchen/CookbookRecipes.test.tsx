import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "@/lib/browser-api";
import { testCookbook, testRecipe } from "@/test/fixtures";
import { typeFullWordAndKeepFocus } from "@/test/sheet-focus";
import { CookbookRecipes } from "./CookbookRecipes";

describe("CookbookRecipes add and remove", () => {
  beforeEach(() => {
    vi.mocked(api).mockReset();
  });

  it("shows Add recipes in the empty state instead of an empty box", () => {
    render(<CookbookRecipes cookbook={testCookbook()} recipes={[]} catalog={[testRecipe()]} />);
    expect(screen.getByText("This cookbook is empty.")).toBeVisible();
    expect(screen.getAllByRole("button", { name: "Add recipes" }).length).toBeGreaterThanOrEqual(2);
  });

  it("opens a searchable picker that marks recipes already in the book", async () => {
    const user = userEvent.setup();
    const pesto = testRecipe({ id: "r1", title: "Weeknight pesto pasta" });
    const kung = testRecipe({ id: "r2", title: "Kung pao chicken" });
    render(
      <CookbookRecipes
        cookbook={testCookbook()}
        recipes={[pesto]}
        catalog={[pesto, kung]}
        booksByRecipe={{ r2: ["Weekend treats"] }}
      />
    );

    await user.click(screen.getByRole("button", { name: "Add recipes" }));
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAccessibleName("Add recipes");
    expect(within(dialog).getByText("Already in this book")).toBeVisible();
    expect(within(dialog).getByText("In Weekend treats")).toBeVisible();
    expect(within(dialog).getByRole("checkbox", { name: /Weeknight pesto pasta/i })).toBeDisabled();

    await typeFullWordAndKeepFocus(user, within(dialog).getByLabelText("Search recipes"), "kung");
    expect(within(dialog).queryByText("Weeknight pesto pasta")).toBeNull();
    expect(within(dialog).getByRole("checkbox", { name: /Kung pao chicken/i })).toBeEnabled();

    await user.click(within(dialog).getByRole("checkbox", { name: /Kung pao chicken/i }));
    await user.click(within(dialog).getByRole("button", { name: "Add 1 recipe" }));
    expect(api).toHaveBeenCalledWith(
      "/api/v1/cookbooks/00000000-0000-4000-8000-000000000020/recipes",
      {
        method: "POST",
        body: JSON.stringify({ recipeId: "r2" }),
      }
    );
  });

  it("removes a recipe from the cookbook inline", async () => {
    const user = userEvent.setup();
    vi.mocked(api).mockResolvedValueOnce(undefined);
    const pesto = testRecipe({ id: "r1", title: "Weeknight pesto pasta" });
    render(<CookbookRecipes cookbook={testCookbook()} recipes={[pesto]} catalog={[pesto]} />);
    await user.click(screen.getByRole("button", { name: "Remove" }));
    expect(api).toHaveBeenCalledWith(
      "/api/v1/cookbooks/00000000-0000-4000-8000-000000000020/recipes?recipeId=r1",
      { method: "DELETE" }
    );
    expect(screen.getByText("Removed Weeknight pesto pasta")).toBeVisible();

    vi.mocked(api).mockResolvedValueOnce(undefined);
    await user.click(screen.getByRole("button", { name: "Undo" }));
    expect(api).toHaveBeenCalledWith(
      "/api/v1/cookbooks/00000000-0000-4000-8000-000000000020/recipes",
      {
        method: "POST",
        body: JSON.stringify({ recipeId: "r1" }),
      }
    );
  });
});
