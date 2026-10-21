/* eslint-disable no-undef */
import { generateObject } from "ai";
import { z } from "zod";
import { tagImportAiTimeout } from "@ovenlovin/core/import-ai-unavailable";
import { isAiGatewayConfigured } from "@ovenlovin/core/onboarding";
import { optionalField } from "./llm-schema";
import { generateImportObject, remainingImportBudgetMs, resolveExtractModelId } from "./models";

export const llmRecipeSchema = z.object({
  isRecipe: z.boolean().describe("True only if the page text is a cookable recipe"),
  title: optionalField(z.string()).describe("Recipe title"),
  description: optionalField(z.string()),
  servings: optionalField(z.number().positive()),
  prepTimeMinutes: optionalField(z.number().nonnegative()),
  cookTimeMinutes: optionalField(z.number().nonnegative()),
  totalTimeMinutes: optionalField(z.number().nonnegative()),
  notes: optionalField(z.string()),
  cuisine: optionalField(z.string()),
  course: optionalField(z.string()),
  ingredients: z
    .array(z.object({ text: z.string().describe("Full ingredient line as written") }))
    .optional(),
  steps: z.array(z.object({ text: z.string().describe("Step instruction text") })).optional(),
});

export type LlmRecipeExtractOptions = {
  modelId?: string;
  env?: Record<string, string | undefined>;
  generate?: typeof generateObject;
  /** URL import: clock starts at extract(), so a slow page fetch shrinks the AI budget. */
  startedAt?: number;
};

function minutesToIso(minutes: number | undefined): string | undefined {
  if (minutes == null || !Number.isFinite(minutes) || minutes < 0) return undefined;
  return `PT${Math.round(minutes)}M`;
}

export function llmRecipeToJsonLd(
  recipe: z.output<typeof llmRecipeSchema>
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
  const remaining = remainingImportBudgetMs(options.startedAt ?? Date.now());
  if (remaining === 0) {
    throw tagImportAiTimeout(Object.assign(new Error("aborted"), { name: "TimeoutError" }));
  }

  try {
    const result = await generateImportObject(generate, modelId, {
      schema: llmRecipeSchema,
      abortSignal: AbortSignal.timeout(remaining),
      prompt: `Extract a recipe from this page text if one is present. Preserve exact ingredient lines. If this is not a recipe (a homepage, paywall, or generic article), set isRecipe to false and omit the rest. Do not invent quantities.

Text:
${pageText}`,
    });

    return llmRecipeToJsonLd(result.object as z.output<typeof llmRecipeSchema>);
  } catch (error) {
    throw tagImportAiTimeout(error);
  }
}
