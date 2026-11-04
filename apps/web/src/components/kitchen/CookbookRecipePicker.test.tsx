import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps } from "react";
import { describe, expect, it, vi } from "vitest";
import { testRecipe } from "@/test/fixtures";
import { typeFullWordAndKeepFocus } from "@/test/sheet-focus";
import { CookbookRecipePicker } from "./CookbookRecipePicker";

const pesto = testRecipe({ id: "r1", title: "Weeknight pesto pasta" });
const kung = testRecipe({ id: "r2", title: "Kung pao chicken" });
const soup = testRecipe({ id: "r3", title: "Tomato soup" });

function renderPicker(overrides: Partial<ComponentProps<typeof CookbookRecipePicker>> = {}) {
  const onClose = overrides.onClose ?? vi.fn();
  const onAdd = overrides.onAdd ?? vi.fn();
  const view = render(
    <CookbookRecipePicker
      open
      recipes={[pesto, kung, soup]}
      memberIds={new Set([pesto.id])}
      booksByRecipe={{ r2: ["Weekend treats"] }}
      cookbookName="Weeknight dinners"
      pending={false}
      error={null}
      onClose={onClose}
      onAdd={onAdd}
      {...overrides}
    />
  );
  return {
    ...view,
    onClose,
    onAdd,
    dialog: screen.getByRole("dialog", { name: "Add recipes" }),
  };
}

describe("CookbookRecipePicker", () => {
  it("uses a secondary Cancel Button and a default Add Button", () => {
    const { dialog } = renderPicker();

    expect(dialog.querySelector(".recipe-picker")).not.toBeNull();
    expect(dialog.querySelector(".sheet-actions")).not.toBeNull();
    expect(dialog.querySelector(".btn")).toBeNull();

    const cancel = within(dialog).getByRole("button", { name: "Cancel" });
    expect(cancel.tagName).toBe("BUTTON");
    expect(cancel).toHaveAttribute("data-slot", "button");
    expect(cancel).toHaveAttribute("data-variant", "secondary");
    expect(cancel).toHaveAttribute("data-size", "md");
    expect(cancel).toHaveAttribute("type", "button");
    expect(cancel).toHaveClass("ds-button", "ds-button--secondary");
    expect(cancel).not.toHaveClass("btn");
    expect(cancel).toBeEnabled();

    const add = within(dialog).getByRole("button", { name: "Add 0 recipes" });
    expect(add.tagName).toBe("BUTTON");
    expect(add).toHaveAttribute("data-slot", "button");
    expect(add).toHaveAttribute("data-variant", "default");
    expect(add).toHaveAttribute("type", "button");
    expect(add).toHaveClass("ds-button", "ds-button--default");
    expect(add).not.toHaveClass("btn");
    expect(add).toBeDisabled();
    expect(add).not.toHaveAttribute("aria-busy");
    expect(add).not.toHaveAttribute("href");
  });

  it("keeps in-book rows locked and adds the recipes that were selected", async () => {
    const user = userEvent.setup();
    const { onAdd, dialog } = renderPicker();

    expect(within(dialog).getByText("Already in this book")).toBeVisible();
    expect(within(dialog).getByText("In Weekend treats")).toBeVisible();
    const already = within(dialog).getByRole("checkbox", { name: /Weeknight pesto pasta/i });
    expect(already).toBeChecked();
    expect(already).toBeDisabled();

    await user.click(within(dialog).getByRole("checkbox", { name: /Kung pao chicken/i }));
    const one = within(dialog).getByRole("button", { name: "Add 1 recipe" });
    expect(one).toBeEnabled();

    await user.click(within(dialog).getByRole("checkbox", { name: /Tomato soup/i }));
    const two = within(dialog).getByRole("button", { name: "Add 2 recipes" });
    expect(two).toBeEnabled();

    await user.click(within(dialog).getByRole("checkbox", { name: /Kung pao chicken/i }));
    await user.click(within(dialog).getByRole("button", { name: "Add 1 recipe" }));
    expect(onAdd).toHaveBeenCalledOnce();
    expect(onAdd).toHaveBeenCalledWith(["r3"]);
  });

  it("filters the list and clears the selection when the sheet reopens", async () => {
    const user = userEvent.setup();
    const { dialog, rerender, onClose, onAdd } = renderPicker();

    await user.click(within(dialog).getByRole("checkbox", { name: /Tomato soup/i }));
    expect(within(dialog).getByRole("button", { name: "Add 1 recipe" })).toBeEnabled();

    await typeFullWordAndKeepFocus(user, within(dialog).getByLabelText("Search recipes"), "kung");
    expect(within(dialog).queryByText("Tomato soup")).toBeNull();
    expect(within(dialog).queryByText("Weeknight pesto pasta")).toBeNull();
    expect(within(dialog).getByRole("checkbox", { name: /Kung pao chicken/i })).toBeEnabled();

    await user.clear(within(dialog).getByLabelText("Search recipes"));
    await typeFullWordAndKeepFocus(user, within(dialog).getByLabelText("Search recipes"), "nope");
    expect(within(dialog).getByText("No recipes match that search.")).toBeVisible();

    rerender(
      <CookbookRecipePicker
        open={false}
        recipes={[pesto, kung, soup]}
        memberIds={new Set([pesto.id])}
        pending={false}
        error={null}
        onClose={onClose}
        onAdd={onAdd}
      />
    );
    expect(screen.queryByRole("dialog")).toBeNull();

    rerender(
      <CookbookRecipePicker
        open
        recipes={[pesto, kung, soup]}
        memberIds={new Set([pesto.id])}
        pending={false}
        error={null}
        onClose={onClose}
        onAdd={onAdd}
      />
    );
    const reopened = screen.getByRole("dialog", { name: "Add recipes" });
    expect(within(reopened).getByLabelText("Search recipes")).toHaveValue("");
    expect(within(reopened).getByRole("button", { name: "Add 0 recipes" })).toBeDisabled();
    expect(within(reopened).getByText("Tomato soup")).toBeVisible();
  });

  it("disables Cancel and shows Add loading while pending", async () => {
    const user = userEvent.setup();
    const { onClose, onAdd, dialog } = renderPicker({
      pending: true,
      error: "Could not add recipes",
    });

    const cancel = within(dialog).getByRole("button", { name: "Cancel" });
    expect(cancel).toBeDisabled();
    expect(cancel).not.toHaveAttribute("aria-busy");
    await user.click(cancel);
    expect(onClose).not.toHaveBeenCalled();

    const add = within(dialog).getByRole("button", { name: "Add 0 recipes" });
    expect(add).toBeDisabled();
    expect(add).toHaveAttribute("aria-busy", "true");
    expect(add).toHaveAttribute("data-loading", "true");
    expect(add).toHaveClass("ds-button--loading");
    expect(add.querySelector(".ds-button__spinner")).not.toBeNull();
    expect(add).toHaveTextContent("Add 0 recipes");
    expect(add).not.toHaveTextContent("Adding");
    await user.click(add);
    expect(onAdd).not.toHaveBeenCalled();

    expect(within(dialog).getByText("Could not add recipes")).toBeVisible();
  });

  it("calls onClose from Cancel when the picker is idle", async () => {
    const user = userEvent.setup();
    const { onClose, onAdd, dialog } = renderPicker();

    await user.click(within(dialog).getByRole("button", { name: "Cancel" }));
    expect(onClose).toHaveBeenCalledOnce();
    expect(onAdd).not.toHaveBeenCalled();
  });
});
