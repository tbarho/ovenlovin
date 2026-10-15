import type { MealPlanEntry, MealPlanEntryPatch, MealPlanEntryWrite } from "../schemas/plans";

export function mealPlanEntryKey(date: string, meal: string): string {
  return `${date}::${meal}`;
}

export function mealPlanEntryWriteFromRow(entry: MealPlanEntry): MealPlanEntryWrite {
  return {
    date: entry.date,
    meal: entry.mealSlot,
    ...(entry.recipeId ? { recipeId: entry.recipeId } : {}),
    ...(entry.freeformMeal ? { freeformMeal: entry.freeformMeal } : {}),
    ...(entry.servings ? { servings: entry.servings } : {}),
    attendees: entry.attendees ?? [],
    ...(entry.prepAheadNotes ? { prepAheadNotes: entry.prepAheadNotes } : {}),
  };
}

export function resolveMealPlanEntryPatch(
  patch: MealPlanEntryPatch,
  existing: MealPlanEntry | undefined
): MealPlanEntryWrite {
  const recipeId =
    patch.recipeId ?? (patch.freeformMeal ? undefined : (existing?.recipeId ?? undefined));
  const freeformMeal =
    patch.freeformMeal ?? (patch.recipeId ? undefined : (existing?.freeformMeal ?? undefined));
  const servings = patch.servings ?? existing?.servings ?? undefined;
  const attendees = patch.attendees ?? existing?.attendees ?? [];
  const prepAheadNotes = patch.prepAheadNotes ?? existing?.prepAheadNotes ?? undefined;

  return {
    date: patch.date,
    meal: patch.meal,
    ...(recipeId ? { recipeId } : {}),
    ...(freeformMeal ? { freeformMeal } : {}),
    ...(servings ? { servings } : {}),
    attendees,
    ...(prepAheadNotes ? { prepAheadNotes } : {}),
  };
}

export function planPatchesToWrites(patches: MealPlanEntryPatch[]): MealPlanEntryWrite[] {
  return patches
    .filter((patch) => !patch.clear)
    .map((patch) => resolveMealPlanEntryPatch(patch, undefined));
}

export type MealPlanMergePlan = {
  previous: MealPlanEntry[];
  upserts: Array<{ existing: MealPlanEntry | undefined; next: MealPlanEntryWrite }>;
  clearIds: string[];
};

export function planMealPlanEntryMerge(
  existing: MealPlanEntry[],
  patches: MealPlanEntryPatch[]
): MealPlanMergePlan {
  const byKey = new Map(
    existing.map((entry) => [mealPlanEntryKey(entry.date, entry.mealSlot), entry])
  );
  const previous: MealPlanEntry[] = [];
  const upserts: MealPlanMergePlan["upserts"] = [];
  const clearIds: string[] = [];
  const seen = new Set<string>();

  for (const patch of patches) {
    const key = mealPlanEntryKey(patch.date, patch.meal);
    if (seen.has(key)) continue;
    seen.add(key);
    const current = byKey.get(key);
    if (current) previous.push(current);

    if (patch.clear) {
      if (current) clearIds.push(current.id);
      continue;
    }

    upserts.push({ existing: current, next: resolveMealPlanEntryPatch(patch, current) });
  }

  return { previous, upserts, clearIds };
}
