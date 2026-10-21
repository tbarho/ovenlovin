import { render, screen, within } from "@testing-library/react";
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

    await user.click(screen.getByRole("button", { name: "Keep editing" }));
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
    expect(within(dialog).getByRole("button", { name: "Remove photo" })).toBeVisible();
    expect(within(dialog).getByText(/JPEG, PNG, or WebP/i)).toBeVisible();
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
    await user.click(within(dialog).getByRole("button", { name: "Save details" }));
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
    await user.click(within(dialog).getByRole("button", { name: "Save cookbooks" }));
    expect(await screen.findByRole("status")).toHaveTextContent("Saved");
  });
});
