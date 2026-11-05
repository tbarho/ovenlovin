import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "@/lib/browser-api";
import { testCookbook, testRecipe } from "@/test/fixtures";
import { RecipesKitchen } from "./RecipesKitchen";

const pesto = testRecipe({ title: "Weeknight pesto pasta" });
const weeknight = { ...testCookbook(), previewImages: [], recipeCount: 1 };

describe("RecipesKitchen primitives", () => {
  beforeEach(() => {
    vi.mocked(api).mockReset();
  });

  it("uses shared Buttons on the head and Field + Input for search", () => {
    render(<RecipesKitchen cookbooks={[weeknight]} uncategorized={[]} recipes={[pesto]} />);

    const add = screen.getByRole("button", { name: "Add recipe" });
    expect(add).toHaveAttribute("data-slot", "button");
    expect(add).toHaveAttribute("data-variant", "default");

    const create = screen.getByRole("button", { name: "New cookbook" });
    expect(create).toHaveAttribute("data-slot", "button");
    expect(create).toHaveAttribute("data-variant", "secondary");

    const search = screen.getByLabelText("Search recipes");
    expect(search).toHaveAttribute("data-slot", "input");
    expect(screen.getByText("Search recipes").closest("[data-slot='field']")).toHaveClass(
      "ds-field"
    );
  });

  it("creates a cookbook from the Field + Input and keeps Create cookbook while pending", async () => {
    const user = userEvent.setup();
    let resolveCreate: (value: { id: string; name: string }) => void = () => {};
    vi.mocked(api).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveCreate = resolve;
        })
    );

    render(<RecipesKitchen cookbooks={[weeknight]} uncategorized={[]} recipes={[pesto]} />);
    await user.click(screen.getByRole("button", { name: "New cookbook" }));

    const dialog = screen.getByRole("dialog", { name: "New cookbook" });
    const name = within(dialog).getByLabelText("Name");
    expect(name).toHaveAttribute("data-slot", "input");
    expect(within(dialog).getByText("Name").closest("[data-slot='field']")).toHaveClass("ds-field");

    const submit = within(dialog).getByRole("button", { name: "Create cookbook" });
    expect(submit).toHaveAttribute("data-slot", "button");
    expect(submit).toHaveAttribute("data-variant", "default");
    expect(submit).toBeDisabled();

    await user.type(name, "Sunday soups");
    expect(submit).toBeEnabled();
    await user.click(submit);

    expect(submit).toHaveAttribute("aria-busy", "true");
    expect(submit.querySelector(".ds-button__spinner")).not.toBeNull();
    expect(submit).toHaveTextContent("Create cookbook");
    expect(submit).not.toHaveTextContent("Creating");

    resolveCreate({ id: "book-1", name: "Sunday soups" });
    await waitFor(() => {
      expect(api).toHaveBeenCalledWith("/api/v1/cookbooks", {
        method: "POST",
        body: JSON.stringify({ name: "Sunday soups" }),
      });
    });
    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: "New cookbook" })).not.toBeInTheDocument();
    });
  });

  it("shows a Hint error when creating a cookbook fails", async () => {
    const user = userEvent.setup();
    vi.mocked(api).mockRejectedValue(new Error("Could not create cookbook"));

    render(<RecipesKitchen cookbooks={[weeknight]} uncategorized={[]} recipes={[pesto]} />);
    await user.click(screen.getByRole("button", { name: "New cookbook" }));

    const dialog = screen.getByRole("dialog", { name: "New cookbook" });
    await user.type(within(dialog).getByLabelText("Name"), "Sunday soups");
    await user.click(within(dialog).getByRole("button", { name: "Create cookbook" }));

    const error = await screen.findByText("Could not create cookbook");
    expect(error).toHaveAttribute("data-slot", "hint");
    expect(error).toHaveClass("ds-hint--error");
    expect(dialog).toBeVisible();
  });
});

describe("RecipesKitchen add recipe", () => {
  it("keeps import methods off the list until Add recipe is pressed", async () => {
    const user = userEvent.setup();
    render(<RecipesKitchen cookbooks={[weeknight]} uncategorized={[]} recipes={[pesto]} />);

    expect(screen.getByRole("button", { name: "Add recipe" })).toBeVisible();
    expect(screen.queryByRole("heading", { name: "Import a recipe" })).not.toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Save from your browser" })
    ).not.toBeInTheDocument();
    expect(screen.queryByText("Save from Safari on iPhone")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Search recipes")).toBeVisible();
    expect(screen.getByRole("tab", { name: "All recipes" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Weeknight pesto pasta" })).toBeVisible();
    expect(screen.queryByRole("region", { name: "Getting started" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Add recipe" }));
    expect(screen.getByRole("heading", { name: "Import a recipe" })).toBeVisible();
    expect(screen.getByRole("tab", { name: "URL" })).toBeVisible();
    expect(screen.getByRole("tab", { name: "Paste" })).toBeVisible();
    expect(screen.getByRole("tab", { name: "Photo" })).toBeVisible();
    expect(
      screen.queryByRole("heading", { name: "Save from your browser" })
    ).not.toBeInTheDocument();
    expect(screen.getByText("Save from Safari on iPhone")).toBeVisible();
    expect(screen.getByText("Bookmarklet for desktop browsers")).toBeVisible();
  });

  it("shows import methods immediately when the kitchen has no recipes", () => {
    render(<RecipesKitchen cookbooks={[]} uncategorized={[]} recipes={[]} />);

    expect(screen.getByRole("heading", { name: "Import a recipe" })).toBeVisible();
    expect(screen.getByRole("tab", { name: "URL" })).toBeVisible();
    expect(screen.getByRole("tab", { name: "Paste" })).toBeVisible();
    expect(screen.getByRole("tab", { name: "Photo" })).toBeVisible();
    expect(
      screen.queryByRole("heading", { name: "Save from your browser" })
    ).not.toBeInTheDocument();
    expect(screen.getByText("Save from Safari on iPhone")).toBeVisible();
    expect(screen.getByRole("region", { name: "Getting started" })).toBeVisible();
    expect(screen.queryByLabelText("Search recipes")).not.toBeInTheDocument();
  });
});
