import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import {
  testCookbook,
  testPerson,
  testPersonRule,
  testRecipe,
  testRecipeDetails,
} from "@/test/fixtures";
import { typeFullWordAndKeepFocus } from "@/test/sheet-focus";
import { CookbookRecipes } from "./CookbookRecipes";
import { RecipeDetail } from "./RecipeDetail";
import { RecipesKitchen } from "./RecipesKitchen";

describe("kitchen recipe layout", () => {
  it("places who-can-eat next to ingredients instead of a full-viewport block", () => {
    const { container } = render(
      <RecipeDetail
        recipe={testRecipeDetails({ title: "Weeknight pesto pasta" })}
        cookbooks={[testCookbook()]}
        people={[testPerson({ displayName: "Child B" })]}
        rules={[testPersonRule({ target: "peanut", severity: "block" })]}
      />
    );

    expect(container.querySelector(".recipe-layout")).toBeTruthy();
    expect(container.querySelector(".recipe-layout-media")).toBeTruthy();
    expect(container.querySelector(".recipe-layout-body")).toBeTruthy();
    expect(container.querySelector(".who-can-eat")).toBeTruthy();
    expect(container.querySelector(".who-can-eat.olp")).toBeNull();
    expect(screen.getByRole("heading", { name: "Who can eat this" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Ingredients" })).toBeVisible();
    expect(screen.getByRole("link", { name: "← Recipes" })).toBeVisible();
  });

  it("sends the back link to the cookbook the cook came from", () => {
    render(
      <RecipeDetail
        recipe={testRecipeDetails({ title: "Weeknight pesto pasta" })}
        cookbooks={[testCookbook()]}
        backHref="/recipes?cookbook=book-1"
        backLabel="Weeknight dinners"
      />
    );
    expect(screen.getByRole("link", { name: "← Weeknight dinners" })).toHaveAttribute(
      "href",
      "/recipes?cookbook=book-1"
    );
  });

  it("shows recipe notes on the detail page", () => {
    render(
      <RecipeDetail
        recipe={testRecipeDetails({ notes: "Toast the pine nuts first." })}
        cookbooks={[testCookbook()]}
      />
    );
    expect(screen.getByRole("heading", { name: "Notes" })).toBeVisible();
    expect(screen.getByText("Toast the pine nuts first.")).toBeVisible();
  });
});

describe("kitchen sheet-hosted forms", () => {
  it("keeps focus while typing a recipe title", async () => {
    const user = userEvent.setup();
    render(<RecipeDetail recipe={testRecipeDetails()} cookbooks={[testCookbook()]} />);
    await user.click(screen.getByRole("button", { name: "Edit details" }));
    await typeFullWordAndKeepFocus(user, screen.getByLabelText("Title"), "Garlic");
    await typeFullWordAndKeepFocus(user, screen.getByLabelText("Notes"), "ahead");
  });

  it("keeps focus while typing recipe photo URL, ingredients, and steps", async () => {
    const user = userEvent.setup();
    render(<RecipeDetail recipe={testRecipeDetails()} cookbooks={[testCookbook()]} />);

    await user.click(screen.getByRole("button", { name: "Edit image" }));
    await typeFullWordAndKeepFocus(
      user,
      screen.getByPlaceholderText("https://example.com/pasta.jpg"),
      "https://example.com/garlic.jpg"
    );
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Close" }));
    await user.click(screen.getByRole("button", { name: "Discard" }));

    await user.click(screen.getByRole("button", { name: "Edit ingredients" }));
    await typeFullWordAndKeepFocus(user, screen.getByRole("textbox"), "garlic");
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Close" }));
    await user.click(screen.getByRole("button", { name: "Discard" }));

    await user.click(screen.getByRole("button", { name: "Edit steps" }));
    await typeFullWordAndKeepFocus(user, screen.getByRole("textbox"), "simmer");
  });

  it("searches all recipes from the shelf", async () => {
    const user = userEvent.setup();
    render(
      <RecipesKitchen
        cookbooks={[{ ...testCookbook(), previewImages: [], recipeCount: 1 }]}
        uncategorized={[]}
        recipes={[testRecipe({ title: "Weeknight pesto pasta" })]}
      />
    );

    expect(screen.getByRole("tab", { name: "All recipes" })).toBeVisible();
    await user.click(screen.getByRole("tab", { name: "All recipes" }));
    expect(screen.getByRole("heading", { name: "Weeknight pesto pasta" })).toBeVisible();
    await user.type(screen.getByLabelText("Search recipes"), "pesto");
    expect(screen.getByRole("heading", { name: "Weeknight pesto pasta" })).toBeVisible();
    await user.clear(screen.getByLabelText("Search recipes"));
    await user.type(screen.getByLabelText("Search recipes"), "zzz");
    expect(screen.getByText("No recipes match that search.")).toBeVisible();
  });

  it("keeps focus while typing a new cookbook name", async () => {
    const user = userEvent.setup();
    render(<RecipesKitchen cookbooks={[]} uncategorized={[]} recipes={[]} />);
    await user.click(screen.getByRole("button", { name: "New cookbook" }));
    await typeFullWordAndKeepFocus(
      user,
      screen.getByPlaceholderText("Sunday soup, snacks…"),
      "Sunday"
    );
  });

  it("keeps focus while renaming a cookbook", async () => {
    const user = userEvent.setup();
    render(<CookbookRecipes cookbook={testCookbook()} recipes={[]} />);
    await user.click(screen.getByRole("button", { name: "Rename" }));
    await typeFullWordAndKeepFocus(user, screen.getByRole("textbox"), "Batch cook");
  });
});
