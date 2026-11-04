import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Input } from "./input";

describe("Input", () => {
  it("renders a native text input at the medium size", () => {
    render(<Input aria-label="Recipe Title" />);
    const input = screen.getByRole("textbox", { name: "Recipe Title" });
    expect(input.tagName).toBe("INPUT");
    expect(input).toHaveAttribute("type", "text");
    expect(input).toHaveAttribute("data-size", "md");
    expect(input).toHaveClass("ds-input", "ds-input--md");
  });

  it("applies size and type", () => {
    render(<Input aria-label="Email" type="email" size="lg" />);
    const input = screen.getByRole("textbox", { name: "Email" });
    expect(input).toHaveAttribute("type", "email");
    expect(input).toHaveAttribute("data-size", "lg");
    expect(input).toHaveClass("ds-input--lg");
  });

  it("uses the disabled attribute", () => {
    render(<Input aria-label="Recipe Title" disabled />);
    expect(screen.getByRole("textbox", { name: "Recipe Title" })).toBeDisabled();
  });

  it("marks invalid with aria-invalid and the error class", () => {
    render(<Input aria-label="Recipe Title" invalid />);
    const input = screen.getByRole("textbox", { name: "Recipe Title" });
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAttribute("data-invalid", "true");
    expect(input).toHaveClass("ds-input--invalid");
  });
});
