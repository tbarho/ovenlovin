import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "@/lib/browser-api";
import { groupMealsByDate, type PlanRecipePick, type WeekMeal } from "@/lib/week-plan-view";
import { MealPlanWeek } from "./MealPlanWeek";

const pesto: WeekMeal = {
  entryId: "entry-1",
  date: "2026-10-12",
  mealSlot: "dinner",
  recipeId: "recipe-pesto",
  title: "Weeknight pesto pasta",
  href: "/recipes/pesto",
  image: "/e2e-kitchen/pesto-pasta.svg",
  servings: 4,
  isNoCook: false,
  findings: [
    {
      personName: "Child B",
      severity: "block",
      message: "Contains pine nuts, so Child B can't eat this",
    },
  ],
  checkStatus: "complete",
};

const recipes: PlanRecipePick[] = [
  {
    id: "recipe-pesto",
    title: "Weeknight pesto pasta",
    image: "/e2e-kitchen/pesto-pasta.svg",
    servings: 4,
    cookTimeMinutes: 15,
    prepTimeMinutes: 10,
    safety: "block",
    warning: "Contains pine nuts, so Child B can't eat this",
  },
  {
    id: "recipe-tacos",
    title: "Veggie tacos",
    image: null,
    servings: 4,
    cookTimeMinutes: 20,
    prepTimeMinutes: 10,
    safety: "ok",
    warning: null,
  },
];

describe("MealPlanWeek", () => {
  beforeEach(() => {
    vi.mocked(api).mockReset();
    vi.mocked(api).mockResolvedValue({ id: "plan-1" });
  });

  it("shows the week grid, pesto, and Child B's named block", () => {
    render(<MealPlanWeek days={groupMealsByDate("2026-10-12", [pesto])} />);

    expect(screen.getByTestId("meal-plan-week")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Monday" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Weeknight pesto pasta" })).toBeInTheDocument();
    expect(screen.getByText("Contains pine nuts, so Child B can't eat this")).toBeInTheDocument();
    expect(screen.queryByText(/block\s*:/i)).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /view recipe/i })).toHaveAttribute(
      "href",
      "/recipes/pesto"
    );
    expect(screen.getAllByText("Add dinner")).toHaveLength(6);
  });

  it("still shows an empty week so a night can be filled", () => {
    render(<MealPlanWeek days={groupMealsByDate("2026-10-12", [])} weekStart="2026-10-12" />);
    expect(screen.getByTestId("meal-plan-week")).toBeInTheDocument();
    expect(screen.getAllByText("Add dinner")).toHaveLength(7);
  });

  it("lets a cook pick a safer dinner for a blocked night", async () => {
    const user = userEvent.setup();
    render(
      <MealPlanWeek
        days={groupMealsByDate("2026-10-12", [pesto])}
        planId="plan-1"
        weekStart="2026-10-12"
        recipes={recipes}
        entries={[
          {
            id: "entry-1",
            date: "2026-10-12",
            mealSlot: "dinner",
            recipeId: "recipe-pesto",
            freeformMeal: null,
            servings: 4,
            attendees: [],
          },
        ]}
      />
    );

    await user.click(screen.getByRole("button", { name: /monday/i }));
    const editor = screen.getByTestId("plan-editor-2026-10-12");
    expect(within(editor).getByText("Safer picks")).toBeVisible();
    expect(within(editor).getByText("Contains pine nuts, so Child B can't eat this")).toBeVisible();
    expect(within(editor).getByRole("button", { name: /veggie tacos/i })).toBeVisible();
    expect(within(editor).getByRole("button", { name: /weeknight pesto pasta/i })).toBeVisible();

    await user.click(within(editor).getByRole("button", { name: /veggie tacos/i }));
    expect(api).toHaveBeenCalledWith("/api/v1/meal-plans/plan-1", {
      method: "PATCH",
      body: JSON.stringify({
        entries: [
          {
            date: "2026-10-12",
            meal: "dinner",
            recipeId: "recipe-tacos",
            servings: 4,
            attendees: [],
          },
        ],
      }),
    });
  });

  it("marks a night as no-cook and can clear a planned dinner", async () => {
    const user = userEvent.setup();
    render(
      <MealPlanWeek
        days={groupMealsByDate("2026-10-12", [pesto])}
        planId="plan-1"
        weekStart="2026-10-12"
        recipes={recipes}
        entries={[
          {
            id: "entry-1",
            date: "2026-10-12",
            mealSlot: "dinner",
            recipeId: "recipe-pesto",
            freeformMeal: null,
            servings: 4,
            attendees: [],
          },
        ]}
      />
    );

    await user.click(screen.getByRole("button", { name: /monday/i }));
    await user.click(screen.getByRole("button", { name: "No-cook night" }));
    expect(api).toHaveBeenCalledWith("/api/v1/meal-plans/plan-1", {
      method: "PATCH",
      body: JSON.stringify({
        entries: [
          {
            date: "2026-10-12",
            meal: "dinner",
            freeformMeal: "No-cook night",
            servings: 4,
            attendees: [],
          },
        ],
      }),
    });

    vi.mocked(api).mockClear();
    await user.click(screen.getByRole("button", { name: "Clear night" }));
    expect(api).toHaveBeenCalledWith("/api/v1/meal-plans/plan-1", {
      method: "PATCH",
      body: JSON.stringify({ entries: [] }),
    });
  });

  it("creates a plan when Sunday is still empty", async () => {
    const user = userEvent.setup();
    render(
      <MealPlanWeek
        days={groupMealsByDate("2026-10-12", [])}
        weekStart="2026-10-12"
        recipes={recipes}
      />
    );

    await user.click(screen.getByRole("button", { name: /sunday/i }));
    await user.click(screen.getByRole("button", { name: /veggie tacos/i }));
    expect(api).toHaveBeenCalledWith("/api/v1/meal-plans", {
      method: "POST",
      body: JSON.stringify({
        weekStart: "2026-10-12",
        status: "draft",
        entries: [
          {
            date: "2026-10-18",
            meal: "dinner",
            recipeId: "recipe-tacos",
            servings: 4,
            attendees: [],
          },
        ],
      }),
    });
  });
});
