/* eslint-disable no-undef */
import { generateObject } from "ai";
import { gateway } from "@ai-sdk/gateway";
import { z } from "zod";
import { isAiGatewayConfigured } from "@ovenlovin/core/onboarding";
import { resolveExtractModelId } from "./models";

const llmRecipeSchema = z.object({
  isRecipe: z.boolean().describe("True only if the page text is a cookable recipe"),
  title: z.string().optional().describe("Recipe title"),
  description: z.string().optional(),
  servings: z.number().int().positive().optional(),
  prepTimeMinutes: z.number().int().nonnegative().optional(),
  cookTimeMinutes: z.number().int().nonnegative().optional(),
  totalTimeMinutes: z.number().int().nonnegative().optional(),
  notes: z.string().optional(),
  cuisine: z.string().optional(),
  course: z.string().optional(),
  ingredients: z
    .array(z.object({ text: z.string().describe("Full ingredient line as written") }))
    .optional(),
  steps: z.array(z.object({ text: z.string().describe("Step instruction text") })).optional(),
});

export type LlmRecipeExtractOptions = {
  modelId?: string;
  env?: Record<string, string | undefined>;
  generate?: typeof generateObject;
};

function minutesToIso(minutes: number | undefined): string | undefined {
  if (minutes == null || !Number.isFinite(minutes) || minutes < 0) return undefined;
  return `PT${Math.round(minutes)}M`;
}

export function llmRecipeToJsonLd(
  recipe: z.infer<typeof llmRecipeSchema>
): Record<string, unknown> | null {
  if (!recipe.isRecipe) return null;
  const title = recipe.title?.trim() ?? "";
  const ingredients = (recipe.ingredients ?? []).map((item) => item.text.trim()).filter(Boolean);
  const steps = (recipe.steps ?? []).map((item) => item.text.trim()).filter(Boolean);
  if (!title || ingredients.length < 2 || steps.length < 1) return null;

  return {
    "@type": "Recipe",
    name: title,
    description: recipe.description,
    recipeYield: recipe.servings != null ? String(recipe.servings) : undefined,
    prepTime: minutesToIso(recipe.prepTimeMinutes),
    cookTime: minutesToIso(recipe.cookTimeMinutes),
    totalTime: minutesToIso(recipe.totalTimeMinutes),
    recipeCuisine: recipe.cuisine,
    recipeCategory: recipe.course,
    notes: recipe.notes,
    recipeIngredient: ingredients,
    recipeInstructions: steps.map((text) => ({ "@type": "HowToStep", text })),
  };
}

/**
 * Structured recipe from visible page text via Vercel AI Gateway.
 * Skips when the gateway is not configured.
 */
export async function extractRecipeWithLlm(
  pageText: string,
  options: LlmRecipeExtractOptions = {}
): Promise<Record<string, unknown> | null> {
  const env = options.env ?? process.env;
  if (!pageText.trim() || !isAiGatewayConfigured(env)) return null;

  const modelId = resolveExtractModelId(options.modelId, env);
  const generate = options.generate ?? generateObject;

  try {
    const result = await generate({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      model: gateway(modelId) as any,
      schema: llmRecipeSchema,
      prompt: `Extract a recipe from this page text if one is present. Preserve exact ingredient lines. If this is not a recipe (a homepage, paywall, or generic article), set isRecipe to false and omit the rest. Do not invent quantities.

Text:
${pageText}`,
    });

    return llmRecipeToJsonLd(result.object as z.infer<typeof llmRecipeSchema>);
  } catch {
    return null;
  }
}
