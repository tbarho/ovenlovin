import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { Checkbox } from "./checkbox";

describe("Checkbox", () => {
  it("renders a native checkbox named by its children", () => {
    render(<Checkbox>Include Original Cards</Checkbox>);
    const box = screen.getByRole("checkbox", { name: "Include Original Cards" });
    expect(box).toHaveAttribute("type", "checkbox");
    expect(box).not.toBeChecked();
    expect(box.closest("[data-slot='checkbox']")).toHaveClass("ds-checkbox");
  });

  it("toggles when the label is clicked", async () => {
    const user = userEvent.setup();
    render(<Checkbox>Remember This Kitchen</Checkbox>);
    const box = screen.getByRole("checkbox", { name: "Remember This Kitchen" });
    await user.click(screen.getByText("Remember This Kitchen"));
    expect(box).toBeChecked();
  });

  it("uses the disabled attribute", () => {
    render(<Checkbox disabled>Include Original Cards</Checkbox>);
    const box = screen.getByRole("checkbox", { name: "Include Original Cards" });
    expect(box).toBeDisabled();
    expect(box.closest("[data-slot='checkbox']")).toHaveAttribute("data-disabled", "true");
  });

  it("sets the indeterminate property", () => {
    render(<Checkbox indeterminate aria-label="Select Recipes" />);
    const box = screen.getByRole("checkbox", { name: "Select Recipes" });
    expect(box).toHaveProperty("indeterminate", true);
    expect(box.closest("[data-slot='checkbox']")).toHaveAttribute("data-indeterminate", "true");
  });
});
