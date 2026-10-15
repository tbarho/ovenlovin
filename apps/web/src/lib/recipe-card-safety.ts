import type { Person, PersonRule } from "@ovenlovin/core";
import { whoCanEat, type CheckableIngredient, type WhoCanEatResult } from "@/lib/who-can-eat";

export type RecipeSafetySummary = {
  blockPersonIds: string[];
  warnPersonIds: string[];
  warnings: string[];
};

export const EMPTY_RECIPE_SAFETY: RecipeSafetySummary = {
  blockPersonIds: [],
  warnPersonIds: [],
  warnings: [],
};

export function ingredientsForRecipeCheck(
  ingredients: Array<{ id: string; rawText: string; substitutionNotes?: string | null }>
): CheckableIngredient[] {
  return ingredients.map((ingredient) => ({
    id: ingredient.id,
    name: ingredient.rawText,
    substitutionNotes: ingredient.substitutionNotes,
  }));
}

export function recipeSafetySummary(opts: {
  people: Person[];
  rules: PersonRule[];
  ingredients: CheckableIngredient[];
}): RecipeSafetySummary {
  if (opts.people.length === 0) return EMPTY_RECIPE_SAFETY;
  return recipeSafetyFromCheck(whoCanEat(opts));
}

export function recipeSafetyFromCheck(check: WhoCanEatResult): RecipeSafetySummary {
  const blockPersonIds: string[] = [];
  const warnPersonIds: string[] = [];
  const warnings: string[] = [];
  for (const person of check.people) {
    if (person.mark === "ok") continue;
    const warning = person.reasons[0] ?? person.title;
    warnings.push(warning);
    if (person.mark === "block") blockPersonIds.push(person.personId);
    else warnPersonIds.push(person.personId);
  }
  return { blockPersonIds, warnPersonIds, warnings };
}

export function loveTagText(
  hit: { personId: string; personName: string; tag: string },
  safety: Pick<RecipeSafetySummary, "blockPersonIds" | "warnPersonIds">
): string | null {
  if (safety.blockPersonIds.includes(hit.personId)) return null;
  if (safety.warnPersonIds.includes(hit.personId)) {
    return `${hit.personName} loves this - check first`;
  }
  return hit.tag;
}
