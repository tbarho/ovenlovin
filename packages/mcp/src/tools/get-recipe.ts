/**
 * Tool: get_recipe
 *
 * Get full recipe details by ID
 */

import { z } from "zod";
import type { AuthContext } from "../auth/index";
import { CookbookService, RecipeService, backfillParsedIngredient } from "@ovenlovin/core";
import { mcpRecipeImages } from "../media";
import {
  createDbClient,
  recipeIngredient,
  recipeStep,
  recipeNutrition,
  recipeSource,
} from "@ovenlovin/db";
import { eq, asc, and, isNull } from "drizzle-orm";

export const getRecipeSchema = z.object({
  id: z.string().uuid(),
  includeNutrition: z.boolean().default(true),
  includeSource: z.boolean().default(true),
});

export type GetRecipeInput = z.infer<typeof getRecipeSchema>;

export interface GetRecipeOutput {
  id: string;
  title: string;
  description?: string;
  notes: string | null;
  yieldQuantity?: number;
  yieldUnit?: string;
  servings?: number;
  prepTimeMinutes?: number;
  cookTimeMinutes?: number;
  totalTimeMinutes?: number;
  activeTimeMinutes?: number;
  methodTags: string[];
  cuisine?: string;
  course?: string;
  difficulty?: string;
  equipment: string[];
  images: string[];
  ingredients: Array<{
    id: string;
    groupName?: string;
    order: number;
    rawText: string;
    name: string;
    quantity?: { min: number; max?: number };
    unit?: string;
    ingredientName?: string;
    preparation?: string;
    isOptional: boolean;
    substitutionNotes?: string;
  }>;
  steps: Array<{
    id: string;
    order: number;
    text: string;
    timers?: Array<{ duration: number; label?: string }>;
    image?: string;
  }>;
  nutrition?: {
    perServing: boolean;
    calories?: number;
    protein?: number;
    carbohydrates?: number;
    fat?: number;
    fiber?: number;
  };
  source?: {
    type: string;
    url?: string;
    author?: string;
    attribution?: string;
  };
  cookbooks: Array<{ id: string; name: string; slug: string }>;
}

async function handler(input: GetRecipeInput, context: AuthContext): Promise<GetRecipeOutput> {
  const db = createDbClient(process.env.DATABASE_URL!);
  const recipeService = new RecipeService(db);

  const recipe = await recipeService.getRecipe(input.id);

  if (!recipe) {
    throw new Error(`Recipe not found: ${input.id}`);
  }

  // Verify access - recipe must belong to user's household
  if (recipe.householdId !== context.householdId) {
    throw new Error("Unauthorized access to recipe");
  }

  // Fetch ingredients
  const ingredientRows = await db
    .select()
    .from(recipeIngredient)
    .where(and(eq(recipeIngredient.recipeId, input.id), isNull(recipeIngredient.deletedAt)))
    .orderBy(asc(recipeIngredient.order));

  const ingredients = ingredientRows.map((ing) => {
    const parsed = backfillParsedIngredient({
      rawText: ing.rawText,
      quantityMin: ing.quantityMin ? Number(ing.quantityMin) : null,
      quantityMax: ing.quantityMax ? Number(ing.quantityMax) : null,
      unit: ing.unit ?? null,
    });
    return {
      id: ing.id,
      groupName: ing.groupId ?? undefined,
      order: ing.order,
      rawText: ing.rawText,
      name: parsed.name,
      quantity:
        parsed.quantityMin != null
          ? {
              min: parsed.quantityMin,
              max: parsed.quantityMax ?? undefined,
            }
          : undefined,
      unit: parsed.unit ?? undefined,
      ingredientName: parsed.name,
      preparation: ing.preparation ?? undefined,
      isOptional: ing.isOptional ?? false,
      substitutionNotes: ing.substitutionNotes ?? undefined,
    };
  });

  // Fetch steps
  const stepRows = await db
    .select()
    .from(recipeStep)
    .where(and(eq(recipeStep.recipeId, input.id), isNull(recipeStep.deletedAt)))
    .orderBy(asc(recipeStep.order));

  const steps = stepRows.map((step) => ({
    id: step.id,
    order: step.order,
    text: step.text,
    timers: (step.timers as Array<{ duration: number; label?: string }> | null) ?? undefined,
    image: step.image ?? undefined,
  }));

  // Fetch nutrition if requested
  let nutrition: GetRecipeOutput["nutrition"] = undefined;
  if (input.includeNutrition) {
    const [nutritionRow] = await db
      .select()
      .from(recipeNutrition)
      .where(and(eq(recipeNutrition.recipeId, input.id), isNull(recipeNutrition.deletedAt)))
      .limit(1);

    if (nutritionRow) {
      nutrition = {
        perServing: nutritionRow.perServing,
        calories: nutritionRow.calories ? Number(nutritionRow.calories) : undefined,
        protein: nutritionRow.protein ? Number(nutritionRow.protein) : undefined,
        carbohydrates: nutritionRow.carbohydrates ? Number(nutritionRow.carbohydrates) : undefined,
        fat: nutritionRow.fat ? Number(nutritionRow.fat) : undefined,
        fiber: nutritionRow.fiber ? Number(nutritionRow.fiber) : undefined,
      };
    }
  }

  const cookbooks = await new CookbookService(db).listCookbooksForRecipe(input.id);

  let source: GetRecipeOutput["source"] = undefined;
  if (input.includeSource) {
    const [sourceRow] = await db
      .select()
      .from(recipeSource)
      .where(and(eq(recipeSource.recipeId, input.id), isNull(recipeSource.deletedAt)))
      .limit(1);
    if (sourceRow) {
      source = {
        type: sourceRow.type,
        url: sourceRow.url ?? undefined,
        author: sourceRow.author ?? undefined,
        attribution: sourceRow.attribution ?? undefined,
      };
    }
  }

  return {
    id: recipe.id,
    title: recipe.title,
    description: recipe.description ?? undefined,
    notes: recipe.notes ?? null,
    yieldQuantity: recipe.yieldQuantity ?? undefined,
    yieldUnit: recipe.yieldUnit ?? undefined,
    servings: recipe.servings ?? undefined,
    prepTimeMinutes: recipe.prepTimeMinutes ?? undefined,
    cookTimeMinutes: recipe.cookTimeMinutes ?? undefined,
    totalTimeMinutes: recipe.totalTimeMinutes ?? undefined,
    activeTimeMinutes: recipe.activeTimeMinutes ?? undefined,
    methodTags: recipe.methodTags || [],
    cuisine: recipe.cuisine ?? undefined,
    course: recipe.course ?? undefined,
    difficulty: recipe.difficulty ?? undefined,
    equipment: recipe.equipment || [],
    images: mcpRecipeImages(recipe.id, recipe.images),
    cookbooks,
    ingredients,
    steps,
    nutrition,
    source,
  };
}

export const getRecipeTool = {
  name: "get_recipe",
  description:
    "Get full recipe details including ingredients, steps, prep/cook times, notes, images, cookbooks, and source URL.",
  inputSchema: getRecipeSchema,
  handler,
} as const;
