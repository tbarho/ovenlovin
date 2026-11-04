import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Input } from "./input";
import { Hint, Label } from "./label";

describe("Label", () => {
  it("associates Title Case text with a control via htmlFor", () => {
    render(
      <>
        <Label htmlFor="recipe-title">Recipe Title</Label>
        <Input id="recipe-title" />
      </>
    );
    expect(screen.getByLabelText("Recipe Title")).toHaveAttribute("id", "recipe-title");
    expect(screen.getByText("Recipe Title").closest("[data-slot='label']")).toHaveClass("ds-label");
  });

  it("marks a required field without exposing the asterisk to assistive tech", () => {
    render(
      <Label htmlFor="servings" required>
        Servings
      </Label>
    );
    const label = screen.getByText("Servings").closest("[data-slot='label']");
    expect(label).toHaveAttribute("data-required", "true");
    expect(label?.querySelector(".ds-label__required")).toHaveAttribute("aria-hidden", "true");
  });
});

describe("Hint", () => {
  it("renders helper text as a default sibling", () => {
    render(<Hint>Shown on the recipe card.</Hint>);
    const hint = screen.getByText("Shown on the recipe card.");
    expect(hint.tagName).toBe("P");
    expect(hint).toHaveAttribute("data-tone", "default");
    expect(hint).toHaveClass("ds-hint", "ds-hint--default");
  });

  it("renders error text with the error tone", () => {
    render(
      <Hint tone="error" id="title-error">
        Title is required.
      </Hint>
    );
    const hint = screen.getByText("Title is required.");
    expect(hint).toHaveAttribute("data-tone", "error");
    expect(hint).toHaveClass("ds-hint--error");
    expect(hint).toHaveAttribute("id", "title-error");
  });
});
