import { NotFoundError } from "@/lib/api/errors";
import type { Recipe, RecipeDetails } from "@ovenlovin/core";

export function assertRecipeHousehold(
  recipe: Recipe | RecipeDetails | null,
  householdId: string,
  id?: string
): asserts recipe is Recipe | RecipeDetails {
  if (!recipe || recipe.householdId !== householdId) {
    throw new NotFoundError("Recipe", id);
  }
}
