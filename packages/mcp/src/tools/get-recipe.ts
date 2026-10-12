/**
 * Tool: get_recipe
 *
 * Get full recipe details by ID
 */

import { z } from "zod";
import type { AuthContext } from "../auth/index";
import { RecipeService } from "@ovenlovin/core";
import { createDbClient } from "@ovenlovin/db";

export const getRecipeSchema = z.object({
  id: z.string().uuid(),
  includeNutrition: z.boolean().default(true),
  includeSource: z.boolean().default(false),
});

export type GetRecipeInput = z.infer<typeof getRecipeSchema>;

export interface GetRecipeOutput {
  id: string;
  title: string;
  description?: string;
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

  // TODO: Fetch ingredients and steps from related tables
  // For now, returning basic recipe data
  return {
    id: recipe.id,
    title: recipe.title,
    description: recipe.description ?? undefined,
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
    images: recipe.images || [],
    ingredients: [], // TODO: Load from recipe_ingredient table
    steps: [], // TODO: Load from recipe_step table
  };
}

export const getRecipeTool = {
  name: "get_recipe",
  description:
    "Get full recipe details including ingredients, steps, nutrition, and optionally source provenance.",
  inputSchema: getRecipeSchema,
  handler,
} as const;
