/**
 * Tool: search_recipes
 *
 * Search for recipes with filters
 */

import { z } from "zod";
import type { AuthContext } from "../auth/index";
import { RecipeService, PeopleService, type Recipe, type PersonRule } from "@ovenlovin/core";
import { createDbClient, recipeIngredient } from "@ovenlovin/db";
import { eq, and, isNull } from "drizzle-orm";
import {
  LOVE_PREFERENCE_TYPE,
  checkIngredientsAgainstRules,
  loveScore,
  lovesForRecipe,
  type PersonLove,
  type RuleCheckContext,
  type IngredientCheckInput,
} from "@ovenlovin/allergens";

export const searchRecipesSchema = z.object({
  query: z.string().optional(),
  forAttendees: z
    .array(z.string())
    .optional()
    .describe("Filter out recipes with blocking rules for these person IDs"),
  methodTags: z.array(z.string()).optional(),
  maxResults: z.number().int().positive().default(20),
  cursor: z.string().optional(),
});

export type SearchRecipesInput = z.infer<typeof searchRecipesSchema>;

export interface SearchRecipesOutput {
  recipes: Array<{
    id: string;
    title: string;
    description?: string;
    prepTimeMinutes?: number;
    cookTimeMinutes?: number;
    servings?: number;
    methodTags: string[];
    images: string[];
    warnings?: Array<{
      personId: string;
      severity: "block" | "warn" | "prefer_avoid";
      message: string;
    }>;
    loveTags?: string[];
  }>;
  nextCursor?: string;
}

async function handler(
  input: SearchRecipesInput,
  context: AuthContext
): Promise<SearchRecipesOutput> {
  const db = createDbClient(process.env.DATABASE_URL!);
  const recipeService = new RecipeService(db);
  const peopleService = new PeopleService(db);

  // Search recipes
  const result = await recipeService.listRecipes(context.householdId, {
    search: input.query,
    pagination: {
      limit: input.maxResults,
      cursor: input.cursor,
    },
  });

  const householdPeople = await peopleService.listPeopleByHousehold(context.householdId, {
    limit: 40,
  });
  const householdLoves = await peopleService.getPreferencesForPeople(
    householdPeople.items.map((person) => person.id),
    LOVE_PREFERENCE_TYPE
  );
  const lovePeople: PersonLove[] = householdLoves.map((pref) => {
    const person = householdPeople.items.find((item) => item.id === pref.personId);
    return {
      personId: pref.personId,
      personName: person?.displayName ?? "Someone",
      preference: pref,
    };
  });

  // If forAttendees provided, check rules and annotate warnings
  let attendeeRules: Map<string, PersonRule[]> = new Map();
  let personNames: Map<string, string> = new Map();

  if (input.forAttendees && input.forAttendees.length > 0) {
    // Load rules for each attendee
    for (const personId of input.forAttendees) {
      const person = await peopleService.getPerson(personId);
      if (!person) continue;

      // Verify person belongs to the household
      if (person.householdId !== context.householdId) {
        throw new Error(`Unauthorized access to person: ${personId}`);
      }

      personNames.set(personId, person.displayName);
      const rules = await peopleService.getRulesForPerson(personId);
      attendeeRules.set(personId, rules);
    }
  }

  // Process recipes and check rules if needed
  const recipesWithWarnings = await Promise.all(
    result.items.map(async (recipe) => {
      let warnings: Array<{
        personId: string;
        severity: "block" | "warn" | "prefer_avoid";
        message: string;
      }> = [];

      if (input.forAttendees && input.forAttendees.length > 0) {
        warnings = await checkRecipeForAttendees(
          db,
          recipe,
          input.forAttendees,
          attendeeRules,
          personNames
        );
      }

      // Filter by method tags if provided
      if (input.methodTags && input.methodTags.length > 0) {
        const recipeTags = (recipe.methodTags || []) as string[];
        const hasMatchingTag = input.methodTags.some((tag) => recipeTags.includes(tag));
        if (!hasMatchingTag) {
          return null;
        }
      }

      const loveHits = lovesForRecipe(recipe, lovePeople);
      return {
        id: recipe.id,
        title: recipe.title,
        description: recipe.description ?? undefined,
        prepTimeMinutes: recipe.prepTimeMinutes ?? undefined,
        cookTimeMinutes: recipe.cookTimeMinutes ?? undefined,
        servings: recipe.servings ?? undefined,
        methodTags: recipe.methodTags || [],
        images: recipe.images || [],
        warnings: warnings.length > 0 ? warnings : undefined,
        loveTags: loveHits.length > 0 ? [...new Set(loveHits.map((hit) => hit.tag))] : undefined,
        _loveScore: loveScore(recipe, lovePeople),
      };
    })
  );

  // Filter out null results (recipes that didn't match method tags).
  // Rank from the original recipe fields (cuisine/title), not the stripped DTO.
  const recipes = recipesWithWarnings
    .filter((r): r is NonNullable<typeof r> => r !== null)
    .sort((a, b) => {
      const delta = b._loveScore - a._loveScore;
      if (delta !== 0) return delta;
      return a.title.localeCompare(b.title);
    })
    .map(({ _loveScore: _ignored, ...recipe }) => recipe);

  return {
    recipes,
    nextCursor: result.nextCursor ?? undefined,
  };
}

/**
 * Check a recipe against attendee rules
 */
async function checkRecipeForAttendees(
  db: ReturnType<typeof createDbClient>,
  recipe: Recipe,
  attendeeIds: string[],
  attendeeRules: Map<string, PersonRule[]>,
  personNames: Map<string, string>
): Promise<
  Array<{
    personId: string;
    severity: "block" | "warn" | "prefer_avoid";
    message: string;
  }>
> {
  // Load recipe ingredients
  const ingredientRows = await db
    .select()
    .from(recipeIngredient)
    .where(and(eq(recipeIngredient.recipeId, recipe.id), isNull(recipeIngredient.deletedAt)));

  if (ingredientRows.length === 0) {
    return [];
  }

  // Convert to check input format
  const ingredients: IngredientCheckInput[] = ingredientRows.map((ing) => ({
    name: ing.rawText,
    ingredientId: ing.ingredientId ?? undefined,
    confidence: ing.parseConfidence ? Number(ing.parseConfidence) : undefined,
  }));

  // Build rule contexts for all attendees
  const contexts: RuleCheckContext[] = [];
  for (const personId of attendeeIds) {
    const rules = attendeeRules.get(personId);
    const personName = personNames.get(personId);
    if (!rules || !personName) continue;

    for (const rule of rules) {
      contexts.push({
        personId,
        personName,
        rule,
      });
    }
  }

  if (contexts.length === 0) {
    return [];
  }

  // Run rule checker
  const checkResult = checkIngredientsAgainstRules(ingredients, contexts);

  // Convert findings to warnings
  const warnings: Array<{
    personId: string;
    severity: "block" | "warn" | "prefer_avoid";
    message: string;
  }> = [];

  for (const finding of checkResult.findings.block) {
    warnings.push({
      personId: finding.personId,
      severity: "block",
      message: finding.message,
    });
  }

  for (const finding of checkResult.findings.warn) {
    warnings.push({
      personId: finding.personId,
      severity: "warn",
      message: finding.message,
    });
  }

  for (const finding of checkResult.findings.prefer_avoid) {
    warnings.push({
      personId: finding.personId,
      severity: "prefer_avoid",
      message: finding.message,
    });
  }

  return warnings;
}

export const searchRecipesTool = {
  name: "search_recipes",
  description:
    "Search for recipes with optional filters. Can exclude recipes with blocking rules for specific attendees, annotate warnings, and boost dishes someone loves. Loves never hide a recipe.",
  inputSchema: searchRecipesSchema,
  handler,
} as const;
