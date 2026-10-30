import { render, screen, waitFor } from "@testing-library/react";
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

  async function saveInstagramImport(savedId: string) {
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
      .mockResolvedValueOnce({ id: savedId, title: "15-minute miso butter pasta" });
    await user.click(screen.getByRole("button", { name: "+ Import" }));
    await user.type(
      screen.getByPlaceholderText(/instagram.com\/reel/i),
      "https://www.instagram.com/reel/C9mIsoButter/"
    );
    await user.click(screen.getByRole("button", { name: "Import" }));
    await user.click(await screen.findByRole("button", { name: "Save to kitchen" }));
    await user.click(await screen.findByRole("button", { name: "Back to recipes" }));
  }

  it("closes the import sheet from Back to recipes after an Instagram save", async () => {
    render(<RecipesKitchen cookbooks={[weeknight]} uncategorized={[]} recipes={[pesto]} />);

    await saveInstagramImport(pesto.id);

    expect(screen.queryByRole("heading", { name: "Import a recipe" })).not.toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Saved to your kitchen" })
    ).not.toBeInTheDocument();
    const card = screen.getByRole("link", { name: /Weeknight pesto pasta/ });
    await waitFor(() => expect(card).toHaveFocus());
    expect(card).toHaveClass("recipe-card-new");
  });

  it("focuses and marks the new card after the sheet restores focus and the list refreshes", async () => {
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;
    const miso = testRecipe({ id: "recipe-miso", title: "15-minute miso butter pasta" });
    const { rerender } = render(
      <RecipesKitchen cookbooks={[weeknight]} uncategorized={[]} recipes={[pesto]} />
    );

    await saveInstagramImport(miso.id);

    // The sheet hands focus back to its opener first; the refreshed list is not in yet.
    expect(screen.getByRole("button", { name: "+ Import" })).toHaveFocus();
    expect(scrollIntoView).not.toHaveBeenCalled();

    rerender(<RecipesKitchen cookbooks={[weeknight]} uncategorized={[]} recipes={[pesto, miso]} />);

    const card = screen.getByRole("link", { name: /miso butter pasta/ });
    await waitFor(() => expect(card).toHaveFocus());
    expect(card).toHaveClass("recipe-card-new");
    expect(screen.getByRole("link", { name: /Weeknight pesto pasta/ })).not.toHaveClass(
      "recipe-card-new"
    );
    expect(scrollIntoView).toHaveBeenCalledWith({ block: "center" });
    expect(scrollIntoView.mock.contexts[0]).toBe(card);
    Reflect.deleteProperty(Element.prototype, "scrollIntoView");
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
