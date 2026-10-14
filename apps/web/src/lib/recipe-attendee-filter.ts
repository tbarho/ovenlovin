import {
  checkIngredientsAgainstRules,
  hiddenRecipeFromCheck,
  isBlockedForAttendees,
  type HiddenRecipe,
  type IngredientCheckInput,
  type RuleCheckContext,
} from "@ovenlovin/allergens";
import { PeopleService, type Recipe } from "@ovenlovin/core";
import { getDatabase, recipeIngredient } from "@ovenlovin/db";
import { and, eq, inArray, isNull } from "drizzle-orm";

export function parseForAttendeesParam(values: string[]): string[] {
  return values
    .flatMap((value) => value.split(","))
    .map((value) => value.trim())
    .filter(Boolean);
}

export async function excludeRecipesBlockedForAttendees(
  recipes: Recipe[],
  attendeeIds: string[],
  householdId: string
): Promise<{ items: Recipe[]; hidden: HiddenRecipe[] }> {
  if (attendeeIds.length === 0 || recipes.length === 0) {
    return { items: recipes, hidden: [] };
  }

  const db = getDatabase();
  const peopleService = new PeopleService(db);
  const contexts: RuleCheckContext[] = [];

  for (const personId of attendeeIds) {
    const person = await peopleService.getPerson(personId);
    if (!person || person.householdId !== householdId) {
      throw new Error(`Unauthorized access to person: ${personId}`);
    }
    const rules = await peopleService.getRulesForPerson(personId);
    for (const rule of rules) {
      contexts.push({
        personId: person.id,
        personName: person.displayName,
        rule,
      });
    }
  }

  if (contexts.length === 0) return { items: recipes, hidden: [] };

  const recipeIds = recipes.map((item) => item.id);
  const ingredientRows = await db
    .select()
    .from(recipeIngredient)
    .where(and(inArray(recipeIngredient.recipeId, recipeIds), isNull(recipeIngredient.deletedAt)));

  const ingredientsByRecipe = new Map<string, IngredientCheckInput[]>();
  for (const row of ingredientRows) {
    const list = ingredientsByRecipe.get(row.recipeId) ?? [];
    list.push({
      name: row.rawText,
      ingredientId: row.ingredientId ?? undefined,
      confidence: row.parseConfidence ? Number(row.parseConfidence) : undefined,
    });
    ingredientsByRecipe.set(row.recipeId, list);
  }

  const items: Recipe[] = [];
  const hidden: HiddenRecipe[] = [];
  for (const recipe of recipes) {
    const ingredients = ingredientsByRecipe.get(recipe.id) ?? [];
    if (ingredients.length === 0) {
      items.push(recipe);
      continue;
    }
    const check = checkIngredientsAgainstRules(ingredients, contexts);
    if (isBlockedForAttendees(check)) {
      const hiddenRecipe = hiddenRecipeFromCheck(recipe, check);
      if (hiddenRecipe) hidden.push(hiddenRecipe);
      continue;
    }
    items.push(recipe);
  }
  return { items, hidden };
}
