import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "@/lib/browser-api";
import { ShoppingList } from "./ShoppingList";

describe("ShoppingList", () => {
  beforeEach(() => {
    vi.mocked(api).mockReset();
    vi.mocked(api).mockResolvedValue({ checkedKeys: [], extras: [] });
  });

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
        planId="plan-1"
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
    expect(api).toHaveBeenCalledWith("/api/v1/meal-plans/plan-1/shopping-list/state", {
      method: "PATCH",
      body: JSON.stringify({ checkedKeys: ["pasta"], extras: [] }),
    });
  });

  it("restores saved check-offs and extras after a reload", () => {
    render(
      <ShoppingList
        planId="plan-1"
        checkedKeys={["pasta"]}
        extras={[{ key: "extra-1", name: "paper towels" }]}
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

    expect(screen.getByRole("checkbox", { name: /12 oz pasta/i })).toBeChecked();
    expect(screen.getByText("paper towels")).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: /paper towels/i })).not.toBeChecked();
  });

  it("groups by aisle and saves a jot-down item for the plan week", async () => {
    const user = userEvent.setup();
    render(
      <ShoppingList
        planId="plan-1"
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
    expect(api).toHaveBeenCalledWith(
      "/api/v1/meal-plans/plan-1/shopping-list/state",
      expect.objectContaining({
        method: "PATCH",
        body: expect.stringContaining("paper towels"),
      })
    );
  });
});
