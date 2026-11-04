import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "@/lib/browser-api";
import { testCookbook, testRecipe } from "@/test/fixtures";
import { typeFullWordAndKeepFocus } from "@/test/sheet-focus";
import { CookbookRecipes } from "./CookbookRecipes";

const COOKBOOK_ID = "00000000-0000-4000-8000-000000000020";

describe("CookbookRecipes primitives", () => {
  beforeEach(() => {
    vi.mocked(api).mockReset();
  });

  it("uses secondary opener Buttons, a default empty-state Button, and a ds-button book Link", () => {
    const { container } = render(
      <CookbookRecipes
        cookbook={testCookbook()}
        recipes={[]}
        catalog={[]}
        booksEnabled
        share={{ path: null, blocked: null }}
      />
    );

    const book = screen.getByRole("link", { name: "Open book" });
    expect(book.tagName).toBe("A");
    expect(book).toHaveAttribute("href", `/cookbooks/${COOKBOOK_ID}/book`);
    expect(book).toHaveClass("ds-button", "ds-button--default", "ds-button--md");
    expect(book).not.toHaveClass("btn");

    const actions = container.querySelector(".recipe-actions");
    expect(actions).not.toBeNull();
    for (const name of ["Share", "Add recipes", "Rename", "Delete"]) {
      const button = within(actions as HTMLElement).getByRole("button", { name });
      expect(button).toHaveAttribute("data-slot", "button");
      expect(button).toHaveAttribute("data-variant", "secondary");
      expect(button).toHaveAttribute("type", "button");
      expect(button).not.toHaveClass("btn");
    }

    const empty = container.querySelector(".empty-card");
    expect(empty).not.toBeNull();
    const add = within(empty as HTMLElement).getByRole("button", { name: "Add recipes" });
    expect(add).toHaveAttribute("data-slot", "button");
    expect(add).toHaveAttribute("data-variant", "default");
    expect(add).not.toHaveClass("btn");
    expect(container.querySelector(".btn")).toBeNull();
  });

  it("keeps Save name on the default Button while a rename is pending", async () => {
    const user = userEvent.setup();
    let resolveRename: (value: unknown) => void = () => undefined;
    vi.mocked(api).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveRename = resolve;
        })
    );

    render(<CookbookRecipes cookbook={testCookbook()} recipes={[]} />);
    await user.click(screen.getByRole("button", { name: "Rename" }));
    const dialog = screen.getByRole("dialog", { name: "Rename cookbook" });
    const save = within(dialog).getByRole("button", { name: "Save name" });
    expect(save).toHaveAttribute("data-slot", "button");
    expect(save).toHaveAttribute("data-variant", "default");
    expect(save).toHaveAttribute("type", "submit");
    expect(dialog.querySelector(".btn")).toBeNull();

    await user.click(save);
    expect(save).toBeDisabled();
    expect(save).toHaveAttribute("aria-busy", "true");
    expect(save).toHaveAttribute("data-loading", "true");
    expect(save.querySelector(".ds-button__spinner")).not.toBeNull();
    expect(save).toHaveTextContent("Save name");
    expect(save).not.toHaveTextContent("Saving");
    expect(api).toHaveBeenCalledWith(`/api/v1/cookbooks/${COOKBOOK_ID}`, {
      method: "PATCH",
      body: JSON.stringify({ name: "Weeknight dinners" }),
    });

    resolveRename({});
    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: "Rename cookbook" })).not.toBeInTheDocument()
    );
  });
});

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
    expect(await screen.findByRole("status")).toHaveTextContent("Added to Weeknight dinners");
    expect(api).toHaveBeenCalledWith(
      "/api/v1/cookbooks/00000000-0000-4000-8000-000000000020/recipes",
      {
        method: "POST",
        body: JSON.stringify({ recipeId: "r2" }),
      }
    );
  });

  it("shows a delete error in the confirm sheet", async () => {
    const user = userEvent.setup();
    vi.mocked(api).mockRejectedValueOnce(new Error("This demo sandbox allows 60 writes per hour."));
    render(<CookbookRecipes cookbook={testCookbook()} recipes={[testRecipe()]} catalog={[]} />);
    await user.click(screen.getByRole("button", { name: "Delete" }));
    const dialog = screen.getByRole("dialog", { name: /delete cookbook/i });
    await user.click(within(dialog).getByRole("button", { name: "Delete cookbook" }));
    expect(
      await within(dialog).findByText("This demo sandbox allows 60 writes per hour.")
    ).toBeVisible();
  });

  it("removes a recipe from the cookbook inline", async () => {
    const user = userEvent.setup();
    vi.mocked(api).mockResolvedValueOnce(undefined);
    const pesto = testRecipe({ id: "r1", title: "Weeknight pesto pasta" });
    render(<CookbookRecipes cookbook={testCookbook()} recipes={[pesto]} catalog={[pesto]} />);
    await user.click(screen.getByRole("button", { name: "Recipe actions" }));
    await user.click(screen.getByRole("menuitem", { name: "Remove" }));
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
