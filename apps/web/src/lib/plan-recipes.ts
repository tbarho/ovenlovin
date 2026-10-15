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

export function recipeNeedsPlanConfirm(recipe: PlanRecipePick): boolean {
  return recipe.safety === "block" || recipe.safety === "warn";
}

export function planRiskConfirmCopy(
  recipe: PlanRecipePick,
  weekday: string
): { title: string; body: string } {
  const why = recipe.warning?.trim() || "This recipe may not be safe for everyone on the plan.";
  return {
    title: `Add ${recipe.title} to ${weekday}?`,
    body: `${why} You can still add it — the warning stays on ${weekday} until you pick something else.`,
  };
}

export function findingsForRecipePick(recipe: PlanRecipePick | undefined): {
  findings: WeekFinding[];
  checkStatus: WeekMeal["checkStatus"];
} {
  if (!recipe) return { findings: [], checkStatus: "complete" };
  if (recipe.safety === "unknown") {
    return {
      findings: recipe.warning
        ? [{ personName: "", severity: "warn", message: recipe.warning }]
        : [],
      checkStatus: "incomplete",
    };
  }
  if (recipe.safety === "ok" || !recipe.warning) {
    return { findings: [], checkStatus: "complete" };
  }
  return {
    findings: [
      {
        personName: "",
        severity: recipe.safety === "block" ? "block" : "warn",
        message: recipe.warning,
      },
    ],
    checkStatus: "complete",
  };
}

export function partitionPlanRecipes(
  recipes: PlanRecipePick[],
  query: string,
  currentRecipeId: string | null
): {
  safer: PlanRecipePick[];
  safe: PlanRecipePick[];
  unsafe: PlanRecipePick[];
} {
  const filtered = filterPlanRecipes(recipes, query);
  const ok = filtered.filter((recipe) => recipe.safety === "ok");
  const risky = filtered.filter((recipe) => recipe.safety !== "ok");
  const safer =
    !query.trim() && risky.length > 0
      ? ok.filter((recipe) => recipe.id !== currentRecipeId).slice(0, 3)
      : [];
  const saferIds = new Set(safer.map((recipe) => recipe.id));
  const currentRisky = risky.filter((recipe) => recipe.id === currentRecipeId);
  return {
    safer,
    safe: [...ok.filter((recipe) => !saferIds.has(recipe.id)), ...currentRisky],
    unsafe: risky.filter((recipe) => recipe.id !== currentRecipeId),
  };
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
    const sameRecipe = Boolean(existing && existing.recipeId === next.recipeId);
    const checked = sameRecipe
      ? { findings: existing?.findings ?? [], checkStatus: existing?.checkStatus ?? "complete" }
      : findingsForRecipePick(recipe);
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
      findings: checked.findings,
      checkStatus: checked.checkStatus,
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
