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

    expect(screen.getByRole("button", { name: "+ Import" })).toBeVisible();
    expect(screen.queryByRole("heading", { name: "Import a recipe" })).not.toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Save from your browser" })
    ).not.toBeInTheDocument();
    expect(screen.queryByText("Save from Safari on iPhone")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Search recipes")).toBeVisible();
    expect(screen.getByRole("tab", { name: "All recipes" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Weeknight pesto pasta" })).toBeVisible();
    expect(screen.queryByRole("region", { name: "Getting started" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "+ Import" }));
    expect(screen.getByRole("heading", { name: "Import a recipe" })).toBeVisible();
    expect(screen.getByRole("tab", { name: "Link" })).toBeVisible();
    expect(screen.getByRole("tab", { name: "Photo" })).toBeVisible();
    expect(screen.getByRole("tab", { name: "Cookbook" })).toBeVisible();
    expect(
      screen.queryByRole("heading", { name: "Save from your browser" })
    ).not.toBeInTheDocument();
    expect(screen.getByText("Save from Safari on iPhone")).toBeVisible();
    expect(screen.getByText("Bookmarklet for desktop browsers")).toBeVisible();
  });

  it("shows import methods immediately when the kitchen has no recipes", () => {
    render(<RecipesKitchen cookbooks={[]} uncategorized={[]} recipes={[]} />);

    expect(screen.getByRole("heading", { name: "Import a recipe" })).toBeVisible();
    expect(screen.getByRole("tab", { name: "Link" })).toBeVisible();
    expect(screen.getByRole("tab", { name: "Photo" })).toBeVisible();
    expect(screen.getByRole("tab", { name: "Cookbook" })).toBeVisible();
    expect(
      screen.queryByRole("heading", { name: "Save from your browser" })
    ).not.toBeInTheDocument();
    expect(screen.getByText("Save from Safari on iPhone")).toBeVisible();
    expect(screen.getByRole("region", { name: "Getting started" })).toBeVisible();
    expect(screen.queryByLabelText("Search recipes")).not.toBeInTheDocument();
  });

  it("credits an Instagram recipe on the card", () => {
    render(
      <RecipesKitchen
        cookbooks={[weeknight]}
        uncategorized={[]}
        recipes={[pesto]}
        instagramCredits={{
          [pesto.id]: { handle: "@weeknightwithmaya", url: "https://www.instagram.com/reel/C9" },
        }}
        cookbookNames={{ [pesto.id]: ["Weeknight dinners"] }}
      />
    );
    expect(
      screen.getByText("From @weeknightwithmaya on Instagram · Weeknight dinners")
    ).toBeVisible();
  });
});
