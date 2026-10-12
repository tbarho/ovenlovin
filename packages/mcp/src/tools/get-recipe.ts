/**
 * Tool: get_recipe
 * 
 * Get full recipe details by ID
 */

import { z } from "zod";
import type { AuthContext } from "../auth/index.js";

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

async function handler(
  _input: GetRecipeInput,
  _context: AuthContext
): Promise<GetRecipeOutput> {
  // TODO: Implement using @ovenlovin/core service
  // - Fetch recipe by ID
  // - Check household access
  // - Return full recipe details
  
  throw new Error("Not implemented: get_recipe");
}

export const getRecipeTool = {
  name: "get_recipe",
  description: "Get full recipe details including ingredients, steps, nutrition, and optionally source provenance.",
  inputSchema: getRecipeSchema,
  handler,
} as const;
