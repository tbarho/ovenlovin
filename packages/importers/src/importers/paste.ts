/* eslint-disable no-undef */
import { generateObject } from "ai";
import { gateway } from "@ai-sdk/gateway";
import { z } from "zod";
import type {
  Importer,
  PasteImportInput,
  RawExtraction,
  RecipeDraft,
  ParsedIngredient,
  ParsedStep,
  ImporterConfig,
} from "../types/importer";
import { calculateOverallConfidence, detectMethodTags, extractTimers } from "../utils/confidence";
import { importGenerateOptions } from "../utils/models";

const IMPORTER_VERSION = "0.1.0";

const recipeSchema = z.object({
  title: z.string().describe("Recipe title"),
  description: z.string().optional().describe("Brief description of the recipe"),
  servings: z.number().int().positive().optional().describe("Number of servings"),
  prepTimeMinutes: z.number().int().nonnegative().optional().describe("Prep time in minutes"),
  cookTimeMinutes: z.number().int().nonnegative().optional().describe("Cook time in minutes"),
  totalTimeMinutes: z.number().int().nonnegative().optional().describe("Total time in minutes"),
  notes: z.string().optional().describe("Cook notes, tips, or make-ahead instructions"),
  cuisine: z.string().optional().describe("Cuisine type (e.g., Italian, Mexican)"),
  course: z.string().optional().describe("Course type (e.g., Dessert, Main Course)"),
  ingredients: z
    .array(
      z.object({
        text: z.string().describe("Full ingredient line as written"),
        quantity: z.string().optional().describe("Quantity (e.g., '2', '1/4', '2-3')"),
        unit: z.string().optional().describe("Unit of measurement"),
        ingredient: z.string().optional().describe("Ingredient name"),
        preparation: z
          .string()
          .optional()
          .describe("Preparation notes (e.g., 'diced', 'softened')"),
        optional: z.boolean().optional().describe("Is this ingredient optional?"),
      })
    )
    .describe("List of ingredients"),
  steps: z
    .array(
      z.object({
        text: z.string().describe("Step instruction text"),
      })
    )
    .describe("Cooking steps in order"),
});

export function createPasteImporter(config: ImporterConfig = {}): Importer<PasteImportInput> {
  const modelId = config.modelId || process.env.RK_MODEL_DEFAULT || "spacexai/grok-4.7";

  return {
    name: "paste-importer",
    version: IMPORTER_VERSION,
    sourceType: "paste",

    canHandle(input: PasteImportInput): boolean {
      return input.text.trim().length > 0;
    },

    async extract(input: PasteImportInput): Promise<RawExtraction> {
      const result = await generateObject({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        // gateway() uses AI_GATEWAY_API_KEY, then VERCEL_OIDC_TOKEN / OIDC on Vercel.
        model: gateway(modelId) as any,
        schema: recipeSchema,
        ...importGenerateOptions(),
        prompt: `Extract recipe data from this text. Preserve exact ingredient text. If information is unclear or missing, omit it rather than guessing.

Text:
${input.text}`,
      });

      return {
        sourceType: "paste",
        sourceUrl: input.url,
        author: input.author,
        rawData: result.object as Record<string, unknown>,
        extractedAt: new Date(),
        extractorVersion: IMPORTER_VERSION,
        modelUsed: modelId,
      };
    },

    async toDraft(raw: RawExtraction): Promise<RecipeDraft> {
      const recipe = raw.rawData;

      const title = typeof recipe.title === "string" ? recipe.title : "";
      const description = typeof recipe.description === "string" ? recipe.description : undefined;
      const servings = typeof recipe.servings === "number" ? recipe.servings : undefined;
      const prepTime =
        typeof recipe.prepTimeMinutes === "number" ? recipe.prepTimeMinutes : undefined;
      const cookTime =
        typeof recipe.cookTimeMinutes === "number" ? recipe.cookTimeMinutes : undefined;
      const totalTime =
        typeof recipe.totalTimeMinutes === "number" ? recipe.totalTimeMinutes : undefined;
      const cuisine = typeof recipe.cuisine === "string" ? recipe.cuisine : undefined;
      const course = typeof recipe.course === "string" ? recipe.course : undefined;
      const notes =
        typeof recipe.notes === "string" && recipe.notes.trim() ? recipe.notes.trim() : undefined;

      const ingredients = parseIngredients(recipe.ingredients);
      const steps = parseSteps(recipe.steps);

      const methodTags = detectMethodTags(
        ingredients.map((i) => i.rawText),
        steps.map((s) => s.text)
      );

      const draftWithoutConfidence = {
        title,
        description,
        servings,
        prepTimeMinutes: prepTime,
        cookTimeMinutes: cookTime,
        totalTimeMinutes: totalTime,
        cuisine,
        course,
        notes,
        methodTags,
        ingredients,
        steps,
        source: {
          type: "paste" as const,
          url: raw.sourceUrl,
          author: raw.author,
          importerName: "paste-importer",
          importerVersion: IMPORTER_VERSION,
          modelUsed: raw.modelUsed,
          rawExtractionJson: raw.rawData,
        },
      };

      const confidenceResult = calculateOverallConfidence(draftWithoutConfidence);

      return {
        ...draftWithoutConfidence,
        ...confidenceResult,
      };
    },
  };
}

function parseIngredients(ingredientsData: unknown): ParsedIngredient[] {
  if (!Array.isArray(ingredientsData)) return [];

  return ingredientsData.map((item) => {
    if (typeof item !== "object" || item === null) {
      return {
        rawText: String(item),
        confidence: 0.5,
        confidenceReasons: ["Invalid ingredient format"],
      };
    }

    const ing = item as Record<string, unknown>;
    const rawText = typeof ing.text === "string" ? ing.text : "";

    const hasQuantity = typeof ing.quantity === "string" && ing.quantity.length > 0;
    const hasIngredient = typeof ing.ingredient === "string" && ing.ingredient.length > 0;

    let confidence = 0.85;
    const reasons: string[] = [];

    if (!hasQuantity) {
      confidence -= 0.1;
      reasons.push("Missing quantity");
    }

    if (!hasIngredient) {
      confidence -= 0.1;
      reasons.push("Missing ingredient name");
    }

    if (rawText.includes("?") || rawText.toLowerCase().includes("unclear")) {
      confidence -= 0.2;
      reasons.push("Ambiguous ingredient");
    }

    return {
      rawText,
      quantity: hasQuantity ? parseQuantityString(ing.quantity as string) : undefined,
      unit: typeof ing.unit === "string" ? ing.unit : undefined,
      ingredient: typeof ing.ingredient === "string" ? ing.ingredient : undefined,
      preparation: typeof ing.preparation === "string" ? ing.preparation : undefined,
      isOptional: typeof ing.optional === "boolean" ? ing.optional : false,
      confidence: Math.max(0, Math.min(1, confidence)),
      confidenceReasons: reasons.length > 0 ? reasons : undefined,
    };
  });
}

function parseQuantityString(qty: string): { min: number; max?: number } | undefined {
  const rangeMatch = qty.match(/(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)/);
  if (rangeMatch && rangeMatch[1] && rangeMatch[2]) {
    return {
      min: parseFloat(rangeMatch[1]),
      max: parseFloat(rangeMatch[2]),
    };
  }

  const mixedMatch = qty.match(/(\d+)\s+(\d+)\/(\d+)/);
  if (mixedMatch && mixedMatch[1] && mixedMatch[2] && mixedMatch[3]) {
    const whole = parseInt(mixedMatch[1], 10);
    const numerator = parseInt(mixedMatch[2], 10);
    const denominator = parseInt(mixedMatch[3], 10);
    return { min: whole + numerator / denominator };
  }

  const fractionMatch = qty.match(/(\d+)\/(\d+)/);
  if (fractionMatch && fractionMatch[1] && fractionMatch[2]) {
    const value = parseInt(fractionMatch[1], 10) / parseInt(fractionMatch[2], 10);
    return { min: value };
  }

  const numberMatch = qty.match(/(\d+(?:\.\d+)?)/);
  if (numberMatch && numberMatch[1]) {
    return { min: parseFloat(numberMatch[1]) };
  }

  return undefined;
}

function parseSteps(stepsData: unknown): ParsedStep[] {
  if (!Array.isArray(stepsData)) return [];

  return stepsData.map((item, index) => {
    if (typeof item !== "object" || item === null) {
      return {
        text: String(item),
        order: index,
        confidence: 0.5,
        confidenceReasons: ["Invalid step format"],
      };
    }

    const step = item as Record<string, unknown>;
    const text = typeof step.text === "string" ? step.text : "";

    let confidence = 0.85;
    const reasons: string[] = [];

    if (text.length < 10) {
      confidence -= 0.15;
      reasons.push("Very short step");
    }

    if (text.includes("?") || text.toLowerCase().includes("unclear")) {
      confidence -= 0.2;
      reasons.push("Ambiguous instruction");
    }

    return {
      text,
      order: index,
      timers: extractTimers(text),
      confidence: Math.max(0, Math.min(1, confidence)),
      confidenceReasons: reasons.length > 0 ? reasons : undefined,
    };
  });
}
