import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/kitchen-session", () => ({
  requireKitchenContext: async () => ({
    householdId: "11111111-1111-4111-8111-111111111111",
  }),
}));

vi.mock("@/lib/week-plan", () => ({
  loadWeekKitchen: async () => ({
    plan: null,
    weekStart: "2099-01-05",
    weekLabel: "Jan 5-11, 2099",
    days: [],
    shopping: [],
    shoppingState: { checkedKeys: [], extras: [] },
    entries: [],
    recipes: [],
    defaultServings: 4,
    defaultServingsMode: "household",
    familySize: 4,
    householdCookFor: 4,
  }),
}));

vi.mock("@/components/kitchen/MealPlanWeek", () => ({
  MealPlanWeek: () => null,
}));

import PlansPage from "./page";

const listCtaClasses = ["ds-button", "ds-button--secondary", "ds-button--md"] as const;

function expectLinkCta(element: HTMLElement, classes: readonly string[], href: string) {
  expect(element.tagName).toBe("A");
  expect(element).toHaveAttribute("href", href);
  expect(element).toHaveClass(...classes);
  expect(element).not.toHaveClass("btn");
  expect(element).not.toHaveClass("primary");
  expect(element).not.toHaveAttribute("data-slot");
  expect(element).not.toHaveAttribute("type");
}

describe("plans page", () => {
  it("keeps the Shopping list link as a secondary ds-button", async () => {
    render(await PlansPage({ searchParams: Promise.resolve({}) }));

    const list = screen.getByRole("link", { name: "Shopping list" });
    expectLinkCta(list, listCtaClasses, "/list");
    expect(list.textContent).toBe("Shopping list");
    expect(screen.getByRole("heading", { name: "Jan 5-11, 2099" })).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
