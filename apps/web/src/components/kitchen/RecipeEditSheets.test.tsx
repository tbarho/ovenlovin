import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
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
});
