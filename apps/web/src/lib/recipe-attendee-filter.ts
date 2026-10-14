import {
  checkIngredientsAgainstRules,
  isBlockedForAttendees,
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
): Promise<Recipe[]> {
  if (attendeeIds.length === 0 || recipes.length === 0) return recipes;

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

  if (contexts.length === 0) return recipes;

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

  return recipes.filter((recipe) => {
    const ingredients = ingredientsByRecipe.get(recipe.id) ?? [];
    if (ingredients.length === 0) return true;
    return !isBlockedForAttendees(checkIngredientsAgainstRules(ingredients, contexts));
  });
}
