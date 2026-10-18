import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { testCookbook, testRecipe } from "@/test/fixtures";
import { RecipesKitchen } from "./RecipesKitchen";

const pesto = testRecipe({ title: "Weeknight pesto pasta" });
const weeknight = { ...testCookbook(), previewImages: [], recipeCount: 1 };

describe("RecipesKitchen add recipe", () => {
  it("keeps import methods off the list until Add recipe is pressed", async () => {
    const user = userEvent.setup();
    render(<RecipesKitchen cookbooks={[weeknight]} uncategorized={[]} recipes={[pesto]} />);

    expect(screen.getByRole("button", { name: "Add recipe" })).toBeVisible();
    expect(screen.queryByRole("heading", { name: "Import a recipe" })).not.toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Save from your browser" })
    ).not.toBeInTheDocument();
    expect(screen.getByLabelText("Search recipes")).toBeVisible();
    expect(screen.getByRole("tab", { name: "All recipes" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Weeknight pesto pasta" })).toBeVisible();
    expect(screen.queryByRole("region", { name: "Getting started" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Add recipe" }));
    expect(screen.getByRole("heading", { name: "Import a recipe" })).toBeVisible();
    expect(screen.getByRole("tab", { name: "URL" })).toBeVisible();
    expect(screen.getByRole("tab", { name: "Paste" })).toBeVisible();
    expect(screen.getByRole("tab", { name: "Photo" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Save from your browser" })).toBeVisible();
  });

  it("shows import methods immediately when the kitchen has no recipes", () => {
    render(<RecipesKitchen cookbooks={[]} uncategorized={[]} recipes={[]} />);

    expect(screen.getByRole("heading", { name: "Import a recipe" })).toBeVisible();
    expect(screen.getByRole("tab", { name: "URL" })).toBeVisible();
    expect(screen.getByRole("tab", { name: "Paste" })).toBeVisible();
    expect(screen.getByRole("tab", { name: "Photo" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Save from your browser" })).toBeVisible();
    expect(screen.getByRole("region", { name: "Getting started" })).toBeVisible();
    expect(screen.queryByLabelText("Search recipes")).not.toBeInTheDocument();
  });
});
