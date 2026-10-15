import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { ShoppingList } from "./ShoppingList";

describe("ShoppingList", () => {
  it("lists ingredients and names the person in a block warning", () => {
    render(
      <ShoppingList
        items={[
          {
            key: "pesto",
            name: "1/3 cup basil pesto",
            recipes: ["Weeknight pesto pasta"],
            warnings: [
              {
                personName: "Child B",
                severity: "block",
                message: "Contains tree nuts, so Child B can't eat this",
              },
            ],
          },
        ]}
      />
    );

    expect(screen.getByTestId("shopping-list")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Produce" })).toBeInTheDocument();
    expect(screen.getByText("1/3 cup basil pesto")).toBeInTheDocument();
    expect(screen.getByText("Contains tree nuts, so Child B can't eat this")).toBeInTheDocument();
    expect(screen.queryByText(/block\s*:/i)).not.toBeInTheDocument();
  });

  it("shows one warning when the same person message is repeated", () => {
    render(
      <ShoppingList
        items={[
          {
            key: "cheese",
            name: "mozzarella",
            recipes: ["Baked ziti"],
            warnings: [
              {
                personName: "Parent A",
                severity: "warn",
                message: "Contains dairy, so check with Parent A first",
              },
              {
                personName: "Parent A",
                severity: "warn",
                message: "Contains dairy, so check with Parent A first",
              },
            ],
          },
        ]}
      />
    );

    expect(screen.getAllByText("Contains dairy, so check with Parent A first")).toHaveLength(1);
  });

  it("shows friendly fractions instead of long decimals", () => {
    render(
      <ShoppingList
        items={[
          {
            key: "salt",
            name: "salt",
            quantity: 1.8333,
            unit: "tbsp",
            displayQuantity: "5 1/2",
            displayUnit: "tsp",
            recipes: ["Baked ziti"],
            warnings: [],
          },
        ]}
      />
    );

    expect(screen.getByText(/5 1\/2 tsp/)).toBeInTheDocument();
    expect(screen.queryByText(/1\.83/)).not.toBeInTheDocument();
  });

  it("lets a shopper check an item off without removing the warning", async () => {
    const user = userEvent.setup();
    render(
      <ShoppingList
        items={[
          {
            key: "pasta",
            name: "12 oz pasta",
            recipes: ["Weeknight pesto pasta"],
            warnings: [],
          },
        ]}
      />
    );

    const box = screen.getByRole("checkbox");
    expect(box).not.toBeChecked();
    await user.click(box);
    expect(box).toBeChecked();
  });

  it("groups by aisle and keeps a jot-down item", async () => {
    const user = userEvent.setup();
    render(
      <ShoppingList
        items={[
          { key: "onion", name: "yellow onion", recipes: ["Chili"], warnings: [] },
          { key: "salt", name: "salt", recipes: ["Chili"], warnings: [] },
        ]}
      />
    );

    const headings = screen.getAllByRole("heading");
    expect(headings.map((heading) => heading.textContent)).toEqual(["Produce", "Spices"]);

    await user.type(screen.getByPlaceholderText("Milk, paper towels…"), "paper towels");
    await user.click(screen.getByRole("button", { name: "Add item" }));
    expect(screen.getByRole("heading", { name: "Other" })).toBeInTheDocument();
    expect(screen.getByText("paper towels")).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: /yellow onion/i })).not.toBeChecked();
  });
});
