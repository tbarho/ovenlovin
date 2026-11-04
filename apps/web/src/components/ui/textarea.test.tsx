import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Textarea } from "./textarea";

describe("Textarea", () => {
  it("renders a native textarea with vertical resize", () => {
    render(<Textarea aria-label="Notes" />);
    const field = screen.getByRole("textbox", { name: "Notes" });
    expect(field.tagName).toBe("TEXTAREA");
    expect(field).toHaveAttribute("data-resize", "vertical");
    expect(field).toHaveClass("ds-textarea", "ds-textarea--vertical");
  });

  it("can lock resize", () => {
    render(<Textarea aria-label="Notes" resize="none" />);
    const field = screen.getByRole("textbox", { name: "Notes" });
    expect(field).toHaveAttribute("data-resize", "none");
    expect(field).toHaveClass("ds-textarea--none");
  });

  it("uses the disabled attribute", () => {
    render(<Textarea aria-label="Notes" disabled />);
    expect(screen.getByRole("textbox", { name: "Notes" })).toBeDisabled();
  });

  it("marks invalid with aria-invalid and the error class", () => {
    render(<Textarea aria-label="Notes" invalid />);
    const field = screen.getByRole("textbox", { name: "Notes" });
    expect(field).toHaveAttribute("aria-invalid", "true");
    expect(field).toHaveAttribute("data-invalid", "true");
    expect(field).toHaveClass("ds-textarea--invalid");
  });
});
