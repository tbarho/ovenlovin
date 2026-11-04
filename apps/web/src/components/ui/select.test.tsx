import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { Select } from "./select";

describe("Select", () => {
  it("renders a native select at the medium size", () => {
    render(
      <Select aria-label="Cuisine">
        <option value="italian">Italian</option>
      </Select>
    );
    const select = screen.getByRole("combobox", { name: "Cuisine" });
    expect(select.tagName).toBe("SELECT");
    expect(select).toHaveAttribute("data-size", "md");
    expect(select).toHaveClass("ds-select", "ds-select--md");
  });

  it("applies size", () => {
    render(
      <Select aria-label="Cuisine" size="lg">
        <option value="italian">Italian</option>
      </Select>
    );
    const select = screen.getByRole("combobox", { name: "Cuisine" });
    expect(select).toHaveAttribute("data-size", "lg");
    expect(select).toHaveClass("ds-select--lg");
  });

  it("uses the disabled attribute", () => {
    render(
      <Select aria-label="Cuisine" disabled>
        <option value="italian">Italian</option>
      </Select>
    );
    expect(screen.getByRole("combobox", { name: "Cuisine" })).toBeDisabled();
  });

  it("marks invalid with aria-invalid and the error class", () => {
    render(
      <Select aria-label="Cuisine" invalid>
        <option value="italian">Italian</option>
      </Select>
    );
    const select = screen.getByRole("combobox", { name: "Cuisine" });
    expect(select).toHaveAttribute("aria-invalid", "true");
    expect(select).toHaveAttribute("data-invalid", "true");
    expect(select).toHaveClass("ds-select--invalid");
  });

  it("adds a disabled hidden placeholder option", () => {
    render(
      <Select aria-label="Cuisine" placeholder="Select Cuisine">
        <option value="italian">Italian</option>
        <option value="mexican">Mexican</option>
      </Select>
    );
    const select = screen.getByRole("combobox", { name: "Cuisine" });
    const placeholder = select.querySelector("option[value='']");
    expect(placeholder).toHaveTextContent("Select Cuisine");
    expect(placeholder).toBeDisabled();
    expect(placeholder).toHaveAttribute("hidden");
  });

  it("selects an option", async () => {
    const user = userEvent.setup();
    render(
      <Select aria-label="Cuisine" defaultValue="italian">
        <option value="italian">Italian</option>
        <option value="mexican">Mexican</option>
      </Select>
    );
    const select = screen.getByRole("combobox", { name: "Cuisine" });
    await user.selectOptions(select, "mexican");
    expect(select).toHaveValue("mexican");
  });
});
