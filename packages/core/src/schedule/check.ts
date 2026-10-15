import type { WeeklyNight } from "./week";

export type ScheduleIssueType = "time_budget" | "not_cooking_night" | "attendance";

export type ScheduleIssue = {
  type: ScheduleIssueType;
  message: string;
};

export function weekdayFromIsoDate(date: string): number {
  const match = date.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match?.[1] || !match[2] || !match[3]) return 0;
  return new Date(
    Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12, 0, 0)
  ).getUTCDay();
}

export function nightForDate(week: WeeklyNight[], date: string): WeeklyNight | undefined {
  const dayOfWeek = weekdayFromIsoDate(date);
  return week.find((night) => night.dayOfWeek === dayOfWeek);
}

export function recipeTotalTimeMinutes(
  recipe: {
    totalTimeMinutes?: number | null;
    prepTimeMinutes?: number | null;
    cookTimeMinutes?: number | null;
  } | null
): number | null {
  if (!recipe) return null;
  if (typeof recipe.totalTimeMinutes === "number" && recipe.totalTimeMinutes > 0) {
    return recipe.totalTimeMinutes;
  }
  const prep = recipe.prepTimeMinutes ?? 0;
  const cook = recipe.cookTimeMinutes ?? 0;
  const summed = prep + cook;
  return summed > 0 ? summed : null;
}

export function scheduleIssuesForNight(input: {
  date: string;
  recipeTitle: string;
  recipeTotalMinutes: number | null;
  night: WeeklyNight | undefined;
}): ScheduleIssue[] {
  const issues: ScheduleIssue[] = [];
  const night = input.night;
  if (!night) return issues;

  if (!night.cooking) {
    issues.push({
      type: "not_cooking_night",
      message: `"${input.recipeTitle}" is planned on ${night.day}, which is marked as not a cooking night.`,
    });
    return issues;
  }

  if (input.recipeTotalMinutes == null) return issues;

  if (input.recipeTotalMinutes > night.timeBudgetMinutes) {
    issues.push({
      type: "time_budget",
      message: `"${input.recipeTitle}" takes ${input.recipeTotalMinutes} minutes, which exceeds the ${night.timeBudgetMinutes}-minute budget for ${night.day}.`,
    });
  }

  return issues;
}
