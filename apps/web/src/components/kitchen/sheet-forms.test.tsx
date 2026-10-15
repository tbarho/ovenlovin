import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { testCookbook, testPerson, testPersonRule, testRecipeDetails } from "@/test/fixtures";
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

    await user.click(screen.getByRole("button", { name: "Edit ingredients" }));
    await typeFullWordAndKeepFocus(user, screen.getByRole("textbox"), "garlic");
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Close" }));

    await user.click(screen.getByRole("button", { name: "Edit steps" }));
    await typeFullWordAndKeepFocus(user, screen.getByRole("textbox"), "simmer");
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
