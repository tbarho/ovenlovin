/**
 * Tool: search_recipes
 *
 * Search for recipes with filters
 */

import { z } from "zod";
import type { AuthContext } from "../auth/index";
import { RecipeService, PeopleService, type Recipe, type PersonRule } from "@ovenlovin/core";
import { mcpRecipeImages } from "../media";
import { createDbClient, recipeIngredient } from "@ovenlovin/db";
import { eq, and, isNull } from "drizzle-orm";
import {
  LOVE_PREFERENCE_TYPE,
  attendeeWarningsFromCheck,
  checkIngredientsAgainstRules,
  hiddenRecipeFromCheck,
  isBlockedForAttendees,
  loveScore,
  lovesForRecipe,
  type HiddenRecipe,
  type PersonLove,
  type RuleCheckContext,
  type IngredientCheckInput,
  type RuleCheckResult,
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
  hiddenCount?: number;
  hidden?: HiddenRecipe[];
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
      if (!person || person.householdId !== context.householdId) {
        throw new Error(`Person not found: ${personId}`);
      }

      personNames.set(personId, person.displayName);
      const rules = await peopleService.getRulesForPerson(personId);
      attendeeRules.set(personId, rules);
    }
  }

  // Process recipes and check rules if needed
  const hidden: HiddenRecipe[] = [];
  const recipesWithWarnings = await Promise.all(
    result.items.map(async (recipe) => {
      let warnings: Array<{
        personId: string;
        severity: "block" | "warn" | "prefer_avoid";
        message: string;
      }> = [];

      if (input.forAttendees && input.forAttendees.length > 0) {
        const attendeeCheck = await checkRecipeForAttendees(
          db,
          recipe,
          input.forAttendees,
          attendeeRules,
          personNames
        );
        if (attendeeCheck.blocked) {
          const hiddenRecipe = hiddenRecipeFromCheck(recipe, attendeeCheck.result);
          if (hiddenRecipe) hidden.push(hiddenRecipe);
          return null;
        }
        warnings = attendeeCheck.warnings;
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
        images: mcpRecipeImages(recipe.id, recipe.images),
        warnings: warnings.length > 0 ? warnings : undefined,
        loveTags: loveHits.length > 0 ? [...new Set(loveHits.map((hit) => hit.tag))] : undefined,
        _loveScore: loveScore(recipe, lovePeople),
      };
    })
  );

  // Filter out null results (blocked for attendees or method-tag misses).
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
    ...(input.forAttendees && input.forAttendees.length > 0
      ? { hiddenCount: hidden.length, hidden }
      : {}),
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
): Promise<{
  blocked: boolean;
  warnings: Array<{
    personId: string;
    severity: "block" | "warn" | "prefer_avoid";
    message: string;
  }>;
  result: RuleCheckResult;
}> {
  // Load recipe ingredients
  const ingredientRows = await db
    .select()
    .from(recipeIngredient)
    .where(and(eq(recipeIngredient.recipeId, recipe.id), isNull(recipeIngredient.deletedAt)));

  const emptyResult: RuleCheckResult = {
    status: "complete",
    findings: { block: [], warn: [], prefer_avoid: [] },
  };

  if (ingredientRows.length === 0) {
    return { blocked: false, warnings: [], result: emptyResult };
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
    return { blocked: false, warnings: [], result: emptyResult };
  }

  const checkResult = checkIngredientsAgainstRules(ingredients, contexts);
  return {
    blocked: isBlockedForAttendees(checkResult),
    warnings: attendeeWarningsFromCheck(checkResult),
    result: checkResult,
  };
}

export const searchRecipesTool = {
  name: "search_recipes",
  description:
    "Search for recipes with optional filters. forAttendees hides recipes with a block finding and returns hiddenCount/hidden (id, title, who, ingredient, why). Warn/prefer_avoid stay as warnings. Loves never hide a recipe. Not medical advice - always check ingredient labels before serving.",
  inputSchema: searchRecipesSchema,
  handler,
} as const;
