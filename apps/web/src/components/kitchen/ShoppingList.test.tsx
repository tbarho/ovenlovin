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
    expect(screen.getByText("1/3 cup basil pesto")).toBeInTheDocument();
    expect(screen.getByText("Contains tree nuts, so Child B can't eat this")).toBeInTheDocument();
    expect(screen.queryByText(/block\s*:/i)).not.toBeInTheDocument();
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
