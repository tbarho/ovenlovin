import { PlanService, type Person, type PersonRule } from "@ovenlovin/core";
import { getDatabase } from "@ovenlovin/db";
import {
  ingredientsForRecipeCheck,
  recipeSafetySummary,
  type RecipeSafetySummary,
} from "@/lib/recipe-card-safety";

export async function loadRecipeSafetyById(
  recipeIds: string[],
  people: Person[],
  rules: PersonRule[]
): Promise<Record<string, RecipeSafetySummary>> {
  const unique = [...new Set(recipeIds.filter(Boolean))];
  const grouped = await new PlanService(getDatabase()).getRecipeIngredientsForRecipes(unique);
  const map: Record<string, RecipeSafetySummary> = {};
  for (const id of unique) {
    map[id] = recipeSafetySummary({
      people,
      rules,
      ingredients: ingredientsForRecipeCheck(grouped.get(id) ?? []),
    });
  }
  return map;
}
