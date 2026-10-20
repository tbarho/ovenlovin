import {
  HouseholdService,
  parseServingsQuery,
  presentDisplayedRecipe,
  type HouseholdServingsSettings,
  type RecipeDetails,
} from "@ovenlovin/core";
import { getDatabase } from "@ovenlovin/db";

export async function loadKitchenServingsSettings(
  householdId: string
): Promise<HouseholdServingsSettings> {
  return new HouseholdService(getDatabase()).loadKitchenServingsSettings(householdId);
}

export function presentRecipeForKitchen(
  recipe: RecipeDetails,
  settings: HouseholdServingsSettings,
  servingsQuery?: string | number | null
): RecipeDetails {
  return presentDisplayedRecipe(recipe, {
    familySize: settings.familySize,
    mode: settings.mode,
    fixedServings: settings.servings,
    servingsOverride: parseServingsQuery(servingsQuery),
  });
}
