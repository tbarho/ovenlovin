import { describe, expect, it } from "vitest";
import { defaultWeeklySchedule } from "./week";
import {
  nightForDate,
  recipeTotalTimeMinutes,
  scheduleIssuesForNight,
  weekdayFromIsoDate,
} from "./check";

describe("schedule time-budget check", () => {
  it("maps ISO dates to weekdays in UTC", () => {
    expect(weekdayFromIsoDate("2026-10-28")).toBe(3);
    expect(nightForDate(defaultWeeklySchedule(), "2026-10-28")?.day).toBe("wednesday");
  });

  it("uses total time, then prep plus cook", () => {
    expect(recipeTotalTimeMinutes({ totalTimeMinutes: 95 })).toBe(95);
    expect(recipeTotalTimeMinutes({ prepTimeMinutes: 20, cookTimeMinutes: 75 })).toBe(95);
    expect(recipeTotalTimeMinutes({ prepTimeMinutes: null, cookTimeMinutes: null })).toBe(null);
  });

  it("warns when a recipe exceeds that night's budget", () => {
    const week = defaultWeeklySchedule().map((night) =>
      night.day === "wednesday"
        ? { ...night, busyLevel: "high" as const, timeBudgetMinutes: 20 }
        : night
    );
    const issues = scheduleIssuesForNight({
      date: "2026-10-28",
      recipeTitle: "Roast chicken",
      recipeTotalMinutes: 95,
      night: nightForDate(week, "2026-10-28"),
    });
    expect(issues).toEqual([
      {
        type: "time_budget",
        message:
          '"Roast chicken" takes 95 minutes, which exceeds the 20-minute budget for wednesday.',
      },
    ]);
  });

  it("does not warn when the recipe fits the budget", () => {
    const issues = scheduleIssuesForNight({
      date: "2026-10-28",
      recipeTitle: "Salad",
      recipeTotalMinutes: 15,
      night: nightForDate(defaultWeeklySchedule(), "2026-10-28"),
    });
    expect(issues).toEqual([]);
  });
});
