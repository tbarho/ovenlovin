import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { api } from "@/lib/browser-api";
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

  it("closes the import sheet from Back to recipes after an Instagram save", async () => {
    const user = userEvent.setup();
    vi.mocked(api)
      .mockReset()
      .mockResolvedValueOnce({
        title: "15-minute miso butter pasta",
        servings: 2,
        ingredients: [{ rawText: "8 oz spaghetti" }],
        steps: [{ text: "Boil the pasta." }],
        images: [],
        source: {
          type: "social",
          author: "@weeknightwithmaya",
          url: "https://www.instagram.com/reel/C9mIsoButter",
          rawExtractionJson: { sourcePlatform: "instagram", kind: "reel" },
        },
      })
      .mockResolvedValueOnce({ id: pesto.id, title: "15-minute miso butter pasta" });
    render(<RecipesKitchen cookbooks={[weeknight]} uncategorized={[]} recipes={[pesto]} />);

    await user.click(screen.getByRole("button", { name: "+ Import" }));
    await user.type(
      screen.getByPlaceholderText(/instagram.com\/reel/i),
      "https://www.instagram.com/reel/C9mIsoButter/"
    );
    await user.click(screen.getByRole("button", { name: "Import" }));
    await user.click(await screen.findByRole("button", { name: "Save to kitchen" }));
    await user.click(await screen.findByRole("button", { name: "Back to recipes" }));

    expect(screen.queryByRole("heading", { name: "Import a recipe" })).not.toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Saved to your kitchen" })
    ).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Weeknight pesto pasta/ })).toHaveFocus();
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
