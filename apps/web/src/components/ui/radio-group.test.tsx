import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { Radio, RadioGroup } from "./radio-group";

describe("RadioGroup", () => {
  it("renders a fieldset legend and native radios that share a name", () => {
    render(
      <RadioGroup name="unit" legend="Unit System">
        <Radio value="us">US Customary</Radio>
        <Radio value="metric">Metric</Radio>
      </RadioGroup>
    );
    const group = screen.getByRole("group", { name: "Unit System" });
    expect(group.tagName).toBe("FIELDSET");
    expect(group).toHaveClass("ds-radio-group");
    expect(group.querySelector("legend")).toHaveTextContent("Unit System");

    const us = screen.getByRole("radio", { name: "US Customary" });
    const metric = screen.getByRole("radio", { name: "Metric" });
    expect(us).toHaveAttribute("type", "radio");
    expect(us).toHaveAttribute("name", "unit");
    expect(metric).toHaveAttribute("name", "unit");
    expect(us).not.toBeChecked();
    expect(us.closest("[data-slot='radio']")).toHaveClass("ds-radio");
  });

  it("checks one option and unchecks the other", async () => {
    const user = userEvent.setup();
    render(
      <RadioGroup name="unit" legend="Unit System">
        <Radio value="us">US Customary</Radio>
        <Radio value="metric">Metric</Radio>
      </RadioGroup>
    );
    const us = screen.getByRole("radio", { name: "US Customary" });
    const metric = screen.getByRole("radio", { name: "Metric" });
    await user.click(us);
    expect(us).toBeChecked();
    expect(metric).not.toBeChecked();
    await user.click(metric);
    expect(metric).toBeChecked();
    expect(us).not.toBeChecked();
  });

  it("marks the group required and hides the asterisk from assistive tech", () => {
    render(
      <RadioGroup name="unit" legend="Unit System" required>
        <Radio value="us">US Customary</Radio>
        <Radio value="metric">Metric</Radio>
      </RadioGroup>
    );
    const group = screen.getByRole("group", { name: "Unit System" });
    expect(group).toHaveAttribute("data-required", "true");
    expect(group.querySelector(".ds-radio-group__required")).toHaveAttribute("aria-hidden", "true");
    expect(screen.getByRole("radio", { name: "US Customary" })).toBeRequired();
  });

  it("uses the disabled attribute on an option", () => {
    render(
      <RadioGroup name="unit" legend="Unit System">
        <Radio value="us">US Customary</Radio>
        <Radio value="legacy" disabled>
          Legacy
        </Radio>
      </RadioGroup>
    );
    const option = screen.getByRole("radio", { name: "Legacy" });
    expect(option).toBeDisabled();
    expect(option.closest("[data-slot='radio']")).toHaveAttribute("data-disabled", "true");
  });

  it("disables the fieldset", () => {
    render(
      <RadioGroup name="unit" legend="Unit System" disabled>
        <Radio value="us">US Customary</Radio>
        <Radio value="metric">Metric</Radio>
      </RadioGroup>
    );
    expect(screen.getByRole("group", { name: "Unit System" })).toBeDisabled();
    expect(screen.getByRole("radio", { name: "US Customary" })).toBeDisabled();
  });

  it("replaces helper text with error and marks the group invalid", () => {
    render(
      <RadioGroup
        name="unit"
        legend="Unit System"
        hint="Used on the shopping list."
        error="Pick a unit system."
      >
        <Radio value="us">US Customary</Radio>
        <Radio value="metric">Metric</Radio>
      </RadioGroup>
    );
    const group = screen.getByRole("group", { name: "Unit System" });
    expect(group).toHaveAttribute("aria-invalid", "true");
    expect(screen.queryByText("Used on the shopping list.")).not.toBeInTheDocument();
    const error = screen.getByText("Pick a unit system.");
    expect(error).toHaveClass("ds-hint--error");
    expect(group).toHaveAttribute("aria-describedby", error.id);
  });
});
