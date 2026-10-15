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
                personName: "Jake",
                severity: "block",
                message: "Jake: pesto matches a tree nut block.",
              },
            ],
          },
        ]}
      />
    );

    expect(screen.getByTestId("shopping-list")).toBeInTheDocument();
    expect(screen.getByText("1/3 cup basil pesto")).toBeInTheDocument();
    expect(screen.getByText("Jake: pesto matches a tree nut block.")).toBeInTheDocument();
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
});
