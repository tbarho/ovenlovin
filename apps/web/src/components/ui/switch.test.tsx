import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { Switch } from "./switch";

describe("Switch", () => {
  it("renders a native switch named by its children", () => {
    render(<Switch>Public Demo</Switch>);
    const control = screen.getByRole("switch", { name: "Public Demo" });
    expect(control).toHaveAttribute("type", "checkbox");
    expect(control).not.toBeChecked();
    expect(control.closest("[data-slot='switch']")).toHaveAttribute("data-size", "md");
    expect(control.closest("[data-slot='switch']")).toHaveClass("ds-switch", "ds-switch--md");
  });

  it("applies the small size and accepts aria-label", () => {
    render(<Switch size="sm" aria-label="Show Notes" />);
    const control = screen.getByRole("switch", { name: "Show Notes" });
    expect(control.closest("[data-slot='switch']")).toHaveAttribute("data-size", "sm");
    expect(control.closest("[data-slot='switch']")).toHaveClass("ds-switch--sm");
  });

  it("toggles immediately when clicked", async () => {
    const user = userEvent.setup();
    render(<Switch>Public Demo</Switch>);
    const control = screen.getByRole("switch", { name: "Public Demo" });
    await user.click(control);
    expect(control).toBeChecked();
  });

  it("uses the disabled attribute", () => {
    render(<Switch disabled>Public Demo</Switch>);
    const control = screen.getByRole("switch", { name: "Public Demo" });
    expect(control).toBeDisabled();
    expect(control.closest("[data-slot='switch']")).toHaveAttribute("data-disabled", "true");
  });
});
