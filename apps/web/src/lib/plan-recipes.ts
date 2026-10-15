import type {
  PlanEntryDraft,
  PlanRecipePick,
  WeekDay,
  WeekFinding,
  WeekMeal,
} from "@/lib/week-plan-view";
import { NO_COOK_LABEL } from "@/lib/week-plan-view";

const SAFETY_RANK: Record<PlanRecipePick["safety"], number> = {
  ok: 0,
  warn: 1,
  unknown: 2,
  block: 3,
};

export function filterPlanRecipes(recipes: PlanRecipePick[], query: string): PlanRecipePick[] {
  const needle = query.trim().toLowerCase();
  const matched = needle
    ? recipes.filter((recipe) => recipe.title.toLowerCase().includes(needle))
    : recipes;
  return [...matched].sort((a, b) => {
    const safety = SAFETY_RANK[a.safety] - SAFETY_RANK[b.safety];
    if (safety !== 0) return safety;
    return a.title.localeCompare(b.title);
  });
}

export function saferPicks(
  recipes: PlanRecipePick[],
  currentRecipeId: string | null,
  findings: WeekFinding[]
): PlanRecipePick[] {
  if (findings.every((finding) => finding.severity !== "block")) return [];
  return filterPlanRecipes(recipes, "").filter(
    (recipe) => recipe.safety === "ok" && recipe.id !== currentRecipeId
  );
}

export function dinnerEntryForDate<T extends { date: string; mealSlot: string }>(
  entries: T[],
  date: string
): T | undefined {
  return entries.find((entry) => entry.date === date && entry.mealSlot === "dinner");
}

export function applyDinnerToDays(
  days: WeekDay[],
  date: string,
  next: { recipeId?: string | null; freeformMeal?: string | null; servings?: number | null },
  recipes: PlanRecipePick[]
): WeekDay[] {
  return days.map((day) => {
    if (day.date !== date) return day;
    if (next.recipeId === null && next.freeformMeal === null) {
      return { ...day, meals: day.meals.filter((meal) => meal.mealSlot !== "dinner") };
    }
    const recipe = next.recipeId ? recipes.find((item) => item.id === next.recipeId) : undefined;
    const existing = day.meals.find((meal) => meal.mealSlot === "dinner");
    const meal: WeekMeal = {
      entryId: existing?.entryId ?? `pending-${date}`,
      date,
      mealSlot: "dinner",
      recipeId: next.recipeId ?? null,
      title: recipe?.title ?? next.freeformMeal ?? NO_COOK_LABEL,
      href: recipe ? `/recipes/${recipe.id}` : null,
      image: recipe?.image ?? null,
      servings: next.servings ?? existing?.servings ?? null,
      recipeServings: recipe?.servings ?? existing?.recipeServings ?? null,
      isNoCook: !next.recipeId && Boolean(next.freeformMeal),
      findings: existing && existing.recipeId === next.recipeId ? existing.findings : [],
      checkStatus:
        existing && existing.recipeId === next.recipeId ? existing.checkStatus : "complete",
    };
    return { ...day, meals: [...day.meals.filter((item) => item.mealSlot !== "dinner"), meal] };
  });
}

export function applyDinnerToEntries(
  entries: PlanEntryDraft[],
  date: string,
  next: { recipeId?: string | null; freeformMeal?: string | null; servings?: number | null }
): PlanEntryDraft[] {
  const rest = entries.filter((entry) => !(entry.date === date && entry.mealSlot === "dinner"));
  if (next.recipeId === null && next.freeformMeal === null) return rest;
  const current = dinnerEntryForDate(entries, date);
  return [
    ...rest,
    {
      id: current?.id,
      date,
      mealSlot: "dinner",
      recipeId: next.recipeId ?? null,
      freeformMeal: next.freeformMeal ?? null,
      servings: next.servings ?? current?.servings ?? null,
      attendees: current?.attendees ?? [],
    },
  ];
}
