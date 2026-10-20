import {
  HouseholdService,
  PeopleService,
  parseServingsQuery,
  presentDisplayedRecipe,
  weekDefaultServings,
  type HouseholdServingsSettings,
  type RecipeDetails,
} from "@ovenlovin/core";
import { getDatabase } from "@ovenlovin/db";

export async function loadKitchenServingsSettings(
  householdId: string
): Promise<HouseholdServingsSettings> {
  const db = getDatabase();
  const households = new HouseholdService(db);
  const household = await households.getHousehold(householdId);
  const people = await new PeopleService(db).listPeopleByHousehold(householdId, { limit: 40 });
  if (!household) {
    return {
      mode: "family",
      servings: null,
      familySize: people.items.length,
      defaultCookFor: weekDefaultServings({ familySize: people.items.length, mode: "family" }),
    };
  }
  return households.servingsSettingsFor(household, people.items.length);
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
