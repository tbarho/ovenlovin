import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Button } from "./button";

describe("Button", () => {
  it("renders a native button with Title Case label and default size", () => {
    render(<Button>Save Recipe</Button>);
    const button = screen.getByRole("button", { name: "Save Recipe" });
    expect(button.tagName).toBe("BUTTON");
    expect(button).toHaveAttribute("type", "button");
    expect(button).toHaveAttribute("data-variant", "default");
    expect(button).toHaveAttribute("data-size", "md");
    expect(button).toHaveClass("ds-button", "ds-button--default", "ds-button--md");
  });

  it("applies variant and size classes", () => {
    render(
      <Button variant="secondary" size="lg">
        Secondary
      </Button>
    );
    const button = screen.getByRole("button", { name: "Secondary" });
    expect(button).toHaveAttribute("data-variant", "secondary");
    expect(button).toHaveAttribute("data-size", "lg");
    expect(button).toHaveClass("ds-button--secondary", "ds-button--lg");
  });

  it("uses the disabled attribute and dedicated disabled class path", () => {
    render(<Button disabled>Save Recipe</Button>);
    const button = screen.getByRole("button", { name: "Save Recipe" });
    expect(button).toBeDisabled();
    expect(button).not.toHaveAttribute("aria-busy");
  });

  it("keeps focus when loading and blocks the click handler", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <Button loading onClick={onClick}>
        Save Recipe
      </Button>
    );
    const button = screen.getByRole("button", { name: "Save Recipe" });
    expect(button).toHaveAttribute("aria-busy", "true");
    expect(button).toBeEnabled();
    expect(button.querySelector(".ds-button__spinner")).not.toBeNull();
    await user.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("requires an accessible name for svg-only icon buttons", () => {
    render(
      <Button svgOnly aria-label="Close" shape="circle">
        <svg viewBox="0 0 16 16" />
      </Button>
    );
    const button = screen.getByRole("button", { name: "Close" });
    expect(button).toHaveAttribute("data-svg-only", "true");
    expect(button).toHaveAttribute("data-shape", "circle");
    expect(button).toHaveClass("ds-button--svg-only", "ds-button--circle");
  });
});
