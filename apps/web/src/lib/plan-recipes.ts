import type { PlanRecipePick, WeekFinding } from "@/lib/week-plan-view";

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
