import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MealPlanWeek } from "./MealPlanWeek";
import { groupMealsByDate, type WeekMeal } from "@/lib/week-plan";

const pesto: WeekMeal = {
  entryId: "entry-1",
  date: "2026-10-12",
  mealSlot: "dinner",
  title: "Weeknight pesto pasta",
  href: "/recipes/pesto",
  image: "/e2e-kitchen/pesto-pasta.svg",
  servings: 4,
  findings: [
    {
      personName: "Jake",
      severity: "block",
      message: "Jake: pine nuts match a tree nut block.",
    },
  ],
  checkStatus: "complete",
};

describe("MealPlanWeek", () => {
  it("shows the week grid, pesto, and Jake's named block", () => {
    render(<MealPlanWeek days={groupMealsByDate("2026-10-12", [pesto])} />);

    expect(screen.getByTestId("meal-plan-week")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Monday" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Weeknight pesto pasta" })).toBeInTheDocument();
    expect(screen.getByText("Jake: pine nuts match a tree nut block.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /pesto pasta/i })).toHaveAttribute(
      "href",
      "/recipes/pesto"
    );
    expect(screen.getAllByText("Nothing planned")).toHaveLength(6);
  });

  it("explains an empty week without claiming a clean bill", () => {
    render(<MealPlanWeek days={groupMealsByDate("2026-10-12", [])} />);
    expect(screen.getByText(/nothing planned this week/i)).toBeInTheDocument();
    expect(screen.queryByTestId("meal-plan-week")).not.toBeInTheDocument();
  });
});
