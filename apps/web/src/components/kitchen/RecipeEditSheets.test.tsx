import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { api } from "@/lib/browser-api";
import { testCookbook, testRecipeDetails } from "@/test/fixtures";
import { RecipeDetail } from "./RecipeDetail";

describe("dirty recipe edit sheets", () => {
  it("asks before discarding unsaved step edits on Close or Escape", async () => {
    const user = userEvent.setup();
    render(<RecipeDetail recipe={testRecipeDetails()} cookbooks={[testCookbook()]} />);
    await user.click(screen.getByRole("button", { name: "Edit steps" }));
    const dialog = screen.getByRole("dialog", { name: "Edit steps" });
    await user.type(within(dialog).getByRole("textbox"), "CHANGED");
    await user.keyboard("{Escape}");
    expect(screen.getByTestId("discard-changes")).toHaveTextContent("Discard unsaved changes?");
    expect(screen.getByRole("dialog", { name: "Edit steps" })).toBeVisible();
    expect(dialog.querySelector(".btn")).toBeNull();

    const keep = screen.getByRole("button", { name: "Keep editing" });
    expect(keep).toHaveAttribute("data-slot", "button");
    expect(keep).toHaveAttribute("data-variant", "secondary");
    const discard = screen.getByRole("button", { name: "Discard" });
    expect(discard).toHaveAttribute("data-slot", "button");
    expect(discard).toHaveAttribute("data-variant", "error");

    await user.click(keep);
    expect(screen.queryByTestId("discard-changes")).not.toBeInTheDocument();
    expect((within(dialog).getByRole("textbox") as HTMLTextAreaElement).value).toContain("CHANGED");

    await user.click(within(dialog).getByRole("button", { name: "Close" }));
    await user.click(screen.getByRole("button", { name: "Discard" }));
    expect(screen.queryByRole("dialog", { name: "Edit steps" })).not.toBeInTheDocument();
  });

  it("previews the current recipe photo in the photo sheet", async () => {
    const user = userEvent.setup();
    render(
      <RecipeDetail
        recipe={testRecipeDetails({ images: ["https://example.com/pasta.jpg"] })}
        cookbooks={[testCookbook()]}
      />
    );
    await user.click(screen.getByRole("button", { name: "Edit image" }));
    const dialog = screen.getByRole("dialog", { name: "Recipe photo" });
    expect(within(dialog).getByRole("img", { name: "Recipe photo preview" })).toHaveAttribute(
      "src",
      "https://example.com/pasta.jpg"
    );
    const remove = within(dialog).getByRole("button", { name: "Remove photo" });
    expect(remove).toBeVisible();
    expect(remove).toHaveAttribute("data-variant", "secondary");
    const useUrl = within(dialog).getByRole("button", { name: "Use this URL" });
    expect(useUrl).toHaveAttribute("data-slot", "button");
    expect(useUrl).toHaveAttribute("data-variant", "default");
    expect(useUrl).toBeDisabled();
    expect(dialog.querySelector(".btn")).toBeNull();
    expect(within(dialog).getByText(/JPEG, PNG, or WebP/i)).toBeVisible();
  });

  it("saves the steps sheet when steps are empty", async () => {
    const user = userEvent.setup();
    vi.mocked(api).mockResolvedValueOnce({});
    render(<RecipeDetail recipe={testRecipeDetails()} cookbooks={[testCookbook()]} />);
    await user.click(screen.getByRole("button", { name: "Edit steps" }));
    const dialog = screen.getByRole("dialog", { name: "Edit steps" });
    await user.clear(within(dialog).getByRole("textbox"));
    const save = within(dialog).getByRole("button", { name: "Save steps" });
    expect(save).toHaveAttribute("data-slot", "button");
    expect(save).toHaveAttribute("data-variant", "default");
    expect(save).toHaveAttribute("type", "submit");
    await user.click(save);
    await waitFor(() => expect(api).toHaveBeenCalled());
    expect(JSON.parse(String(vi.mocked(api).mock.calls[0]?.[1]?.body))).toEqual({ steps: [] });
  });

  it("shows Saved after a title or servings save", async () => {
    const user = userEvent.setup();
    vi.mocked(api).mockResolvedValueOnce({});
    render(
      <RecipeDetail
        recipe={testRecipeDetails({ title: "Parent A pasta", servings: 4 })}
        cookbooks={[testCookbook()]}
      />
    );
    await user.click(screen.getByRole("button", { name: "Edit details" }));
    const dialog = screen.getByRole("dialog", { name: "Edit details" });
    await user.clear(within(dialog).getByLabelText("Title"));
    await user.type(within(dialog).getByLabelText("Title"), "Parent A noodles");
    const save = within(dialog).getByRole("button", { name: "Save details" });
    expect(save).toHaveAttribute("data-variant", "default");
    await user.click(save);
    expect(await screen.findByRole("status")).toHaveTextContent("Saved");
  });

  it("shows Saved after adding a recipe to a cookbook", async () => {
    const user = userEvent.setup();
    vi.mocked(api).mockResolvedValueOnce({});
    render(
      <RecipeDetail
        recipe={testRecipeDetails({ title: "Parent A pasta", cookbooks: [] })}
        cookbooks={[testCookbook({ name: "Weekend treats" })]}
      />
    );
    await user.click(screen.getByRole("button", { name: /cookbooks/i }));
    const dialog = screen.getByRole("dialog", { name: "Cookbooks" });
    await user.click(within(dialog).getByLabelText("Weekend treats"));
    const save = within(dialog).getByRole("button", { name: "Save cookbooks" });
    expect(save).toHaveAttribute("data-variant", "default");
    await user.click(save);
    expect(await screen.findByRole("status")).toHaveTextContent("Saved");
  });

  it("marks the save button loading and disabled while a patch is in flight", async () => {
    const user = userEvent.setup();
    let resolveSave: (value: unknown) => void = () => {};
    vi.mocked(api).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveSave = resolve;
        })
    );
    render(<RecipeDetail recipe={testRecipeDetails()} cookbooks={[testCookbook()]} />);
    await user.click(screen.getByRole("button", { name: "Edit ingredients" }));
    const dialog = screen.getByRole("dialog", { name: "Edit ingredients" });
    const save = within(dialog).getByRole("button", { name: "Save ingredients" });
    expect(save).toHaveAttribute("data-variant", "default");
    await user.click(save);
    expect(save).toHaveAttribute("aria-busy", "true");
    expect(save).toBeDisabled();
    expect(save.querySelector(".ds-button__spinner")).not.toBeNull();
    resolveSave({});
    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: "Edit ingredients" })).not.toBeInTheDocument()
    );
  });
});
