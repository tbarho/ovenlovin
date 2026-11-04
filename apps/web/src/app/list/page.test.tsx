import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/kitchen-session", () => ({
  requireKitchenContext: async () => ({
    householdId: "11111111-1111-4111-8111-111111111111",
  }),
}));

vi.mock("@/lib/week-plan", () => ({
  loadWeekKitchen: async () => ({
    weekLabel: "This week",
    plan: null,
    shopping: [],
    shoppingState: { checkedKeys: [], extras: [] },
    defaultServings: 4,
  }),
}));

vi.mock("@/components/kitchen/ShoppingList", () => ({
  ShoppingList: () => null,
}));

import ShoppingListPage from "./page";

const planCtaClasses = ["ds-button", "ds-button--secondary", "ds-button--md"] as const;

function expectLinkCta(element: HTMLElement, classes: readonly string[], href: string) {
  expect(element.tagName).toBe("A");
  expect(element).toHaveAttribute("href", href);
  expect(element).toHaveClass(...classes);
  expect(element).not.toHaveClass("btn");
  expect(element).not.toHaveClass("primary");
  expect(element).not.toHaveAttribute("data-slot");
  expect(element).not.toHaveAttribute("type");
}

describe("shopping list page", () => {
  it("keeps the Plan link as a secondary ds-button", async () => {
    render(await ShoppingListPage());

    const plan = screen.getByRole("link", { name: "← Plan" });
    expectLinkCta(plan, planCtaClasses, "/plans");
    expect(plan.textContent).toBe("← Plan");
    expect(screen.getByRole("heading", { name: "Shopping list" })).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
