export const WEEKDAY_NAMES = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
] as const;

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

export type WeekFinding = {
  personName: string;
  severity: "block" | "warn";
  message: string;
};

export const NO_COOK_LABEL = "No-cook night";

export function planRecipeHref(recipeId: string, servings: number): string {
  return `/recipes/${recipeId}?servings=${servings}&from=plan`;
}

export type WeekMeal = {
  entryId: string;
  date: string;
  mealSlot: string;
  recipeId: string | null;
  title: string;
  href: string | null;
  image: string | null;
  servings: number | null;
  recipeServings?: number | null;
  isNoCook: boolean;
  findings: WeekFinding[];
  checkStatus: "complete" | "incomplete";
};

export type PlanEntryDraft = {
  id?: string;
  date: string;
  mealSlot: string;
  recipeId: string | null;
  freeformMeal: string | null;
  servings: number | null;
  attendees: string[];
};

export type PlanRecipePick = {
  id: string;
  title: string;
  image: string | null;
  servings: number | null;
  cookTimeMinutes: number | null;
  prepTimeMinutes: number | null;
  safety: "ok" | "block" | "warn" | "unknown";
  warning: string | null;
};

export type WeekDay = {
  date: string;
  weekday: string;
  label: string;
  meals: WeekMeal[];
};

export type ShopWarning = {
  personName: string;
  severity: "block" | "warn";
  message: string;
};

export type ShopItem = {
  key: string;
  name: string;
  quantity?: number;
  unit?: string;
  displayQuantity?: string;
  displayUnit?: string;
  recipes: string[];
  warnings: ShopWarning[];
};

export type { ShoppingExtra, ShoppingTripState } from "@ovenlovin/core";

export function parseIsoDate(iso: string): { year: number; month: number; day: number } {
  const [year, month, day] = iso.split("-").map((part) => Number(part));
  if (!year || !month || !day) {
    throw new Error(`Invalid ISO date: ${iso}`);
  }
  return { year, month: month - 1, day };
}

export function formatIsoDate(year: number, month: number, day: number): string {
  const date = new Date(Date.UTC(year, month, day));
  return date.toISOString().slice(0, 10);
}

export function addDays(iso: string, days: number): string {
  const { year, month, day } = parseIsoDate(iso);
  return formatIsoDate(year, month, day + days);
}

export function startOfWeekMonday(iso?: string): string {
  const source = iso ?? new Date().toISOString().slice(0, 10);
  const { year, month, day } = parseIsoDate(source);
  const date = new Date(Date.UTC(year, month, day));
  const weekday = date.getUTCDay();
  const offset = weekday === 0 ? -6 : 1 - weekday;
  return addDays(source, offset);
}

export function weekDates(weekStart: string): string[] {
  return WEEKDAY_NAMES.map((_, index) => addDays(weekStart, index));
}

export function formatDayLabel(iso: string): string {
  const { month, day } = parseIsoDate(iso);
  return `${MONTHS[month]} ${day}`;
}

export function formatWeekRange(weekStart: string): string {
  const start = parseIsoDate(weekStart);
  const endIso = addDays(weekStart, 6);
  const end = parseIsoDate(endIso);
  const startMonth = MONTHS[start.month];
  const endMonth = MONTHS[end.month];
  if (start.year === end.year && start.month === end.month) {
    return `${startMonth} ${start.day}-${end.day}, ${start.year}`;
  }
  if (start.year === end.year) {
    return `${startMonth} ${start.day} - ${endMonth} ${end.day}, ${start.year}`;
  }
  return `${startMonth} ${start.day}, ${start.year} - ${endMonth} ${end.day}, ${end.year}`;
}

export function slotLabel(slot: string): string {
  if (!slot) return "Meal";
  return slot.slice(0, 1).toUpperCase() + slot.slice(1);
}

export function groupMealsByDate(weekStart: string, meals: WeekMeal[]): WeekDay[] {
  const byDate = new Map<string, WeekMeal[]>();
  for (const meal of meals) {
    const list = byDate.get(meal.date) ?? [];
    list.push(meal);
    byDate.set(meal.date, list);
  }
  return weekDates(weekStart).map((date, index) => ({
    date,
    weekday: WEEKDAY_NAMES[index] ?? "Day",
    label: formatDayLabel(date),
    meals: (byDate.get(date) ?? []).slice().sort((a, b) => a.mealSlot.localeCompare(b.mealSlot)),
  }));
}
