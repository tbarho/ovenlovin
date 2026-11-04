import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Field } from "./field";
import { Input } from "./input";
import { Select } from "./select";

describe("Field", () => {
  it("wires a Title Case label to a generated control id", () => {
    render(
      <Field label="Recipe Title">
        <Input />
      </Field>
    );
    const input = screen.getByLabelText("Recipe Title");
    expect(input).toHaveAttribute("id");
    expect(input.id.length).toBeGreaterThan(0);
    expect(screen.getByText("Recipe Title").closest("[data-slot='label']")).toHaveClass("ds-label");
    expect(screen.getByText("Recipe Title").closest("[data-slot='field']")).toHaveClass("ds-field");
  });

  it("keeps an explicit control id", () => {
    render(
      <Field label="Servings">
        <Input id="servings" />
      </Field>
    );
    expect(screen.getByLabelText("Servings")).toHaveAttribute("id", "servings");
  });

  it("points aria-describedby at helper text", () => {
    render(
      <Field label="Recipe Title" hint="Shown on the recipe card.">
        <Input />
      </Field>
    );
    const input = screen.getByLabelText("Recipe Title");
    const hint = screen.getByText("Shown on the recipe card.");
    expect(hint).toHaveClass("ds-hint--default");
    expect(input).toHaveAttribute("aria-describedby", hint.id);
  });

  it("replaces helper text with error and marks the control invalid", () => {
    render(
      <Field label="Recipe Title" hint="Shown on the recipe card." error="Title is required.">
        <Input />
      </Field>
    );
    const input = screen.getByLabelText("Recipe Title");
    expect(screen.queryByText("Shown on the recipe card.")).not.toBeInTheDocument();
    const error = screen.getByText("Title is required.");
    expect(error).toHaveClass("ds-hint--error");
    expect(input).toHaveAttribute("aria-describedby", error.id);
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveClass("ds-input--invalid");
    expect(input.closest("[data-slot='field']")).toHaveAttribute("data-invalid", "true");
  });

  it("marks a required field without exposing the asterisk to assistive tech", () => {
    render(
      <Field label="Servings" required>
        <Input />
      </Field>
    );
    const field = screen.getByText("Servings").closest("[data-slot='field']");
    expect(field).toHaveAttribute("data-required", "true");
    expect(field?.querySelector(".ds-label__required")).toHaveAttribute("aria-hidden", "true");
  });

  it("composes with Select", () => {
    render(
      <Field label="Cuisine" hint="Used to filter the box.">
        <Select placeholder="Select Cuisine">
          <option value="italian">Italian</option>
        </Select>
      </Field>
    );
    const select = screen.getByLabelText("Cuisine");
    expect(select.tagName).toBe("SELECT");
    expect(select).toHaveAttribute("aria-describedby");
    expect(screen.getByRole("combobox", { name: "Cuisine" })).toBe(select);
  });
});
