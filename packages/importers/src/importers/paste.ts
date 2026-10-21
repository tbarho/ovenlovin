/* eslint-disable no-undef */
import { generateObject } from "ai";
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
import { tagImportAiTimeout, throwIfNotARecipe } from "@ovenlovin/core/import-ai-unavailable";
import { calculateOverallConfidence, detectMethodTags, extractTimers } from "../utils/confidence";
import { parseQuantityString } from "../utils/parse-quantity";
import { optionalField } from "../utils/llm-schema";
import {
  IMPORT_GENERATE_TIMEOUT_MS,
  generateImportObject,
  resolveDefaultModelId,
} from "../utils/models";

const IMPORTER_VERSION = "0.1.0";

const recipeSchema = z.object({
  isRecipe: z.boolean().describe("True only if the text is a cookable recipe"),
  title: z.string().describe("Recipe title"),
  description: optionalField(z.string()).describe("Brief description of the recipe"),
  servings: optionalField(z.number().positive()).describe("Number of servings"),
  prepTimeMinutes: optionalField(z.number().nonnegative()).describe("Prep time in minutes"),
  cookTimeMinutes: optionalField(z.number().nonnegative()).describe("Cook time in minutes"),
  totalTimeMinutes: optionalField(z.number().nonnegative()).describe("Total time in minutes"),
  notes: optionalField(z.string()).describe("Cook notes, tips, or make-ahead instructions"),
  cuisine: optionalField(z.string()).describe("Cuisine type (e.g., Italian, Mexican)"),
  course: optionalField(z.string()).describe("Course type (e.g., Dessert, Main Course)"),
  ingredients: z
    .array(
      z.object({
        text: z.string().describe("Full ingredient line as written"),
        quantity: optionalField(z.string()).describe("Quantity (e.g., '2', '1/4', '2-3')"),
        unit: optionalField(z.string()).describe("Unit of measurement"),
        ingredient: optionalField(z.string()).describe("Ingredient name"),
        preparation: optionalField(z.string()).describe(
          "Preparation notes (e.g., 'diced', 'softened')"
        ),
        optional: z.boolean().optional().describe("Is this ingredient optional?"),
      })
    )
    .optional()
    .describe("List of ingredients"),
  steps: z
    .array(
      z.object({
        text: z.string().describe("Step instruction text"),
      })
    )
    .optional()
    .describe("Cooking steps in order"),
});

export function createPasteImporter(config: ImporterConfig = {}): Importer<PasteImportInput> {
  const modelId = resolveDefaultModelId(config.modelId);
  const generate = config.generate ?? generateObject;

  return {
    name: "paste-importer",
    version: IMPORTER_VERSION,
    sourceType: "paste",

    canHandle(input: PasteImportInput): boolean {
      return input.text.trim().length > 0;
    },

    async extract(input: PasteImportInput): Promise<RawExtraction> {
      let result;
      try {
        result = await generateImportObject(generate, modelId, {
          schema: recipeSchema,
          abortSignal: AbortSignal.timeout(IMPORT_GENERATE_TIMEOUT_MS),
          prompt: `Extract recipe data from this text. Preserve exact ingredient text. If this is not a recipe (a greeting, note, or random paragraph), set isRecipe to false and omit the rest. If information is unclear or missing, omit it rather than guessing.

Text:
${input.text}`,
        });
      } catch (error) {
        throw tagImportAiTimeout(error);
      }

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
      throwIfNotARecipe({ ingredients, steps }, recipe.isRecipe);

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
    const quantity = parseQuantityString(hasQuantity ? (ing.quantity as string) : rawText);

    let confidence = 0.85;
    const reasons: string[] = [];

    if (hasQuantity && !quantity) {
      confidence = 0.5;
      reasons.push("Unparseable quantity");
    } else if (!hasQuantity && !quantity) {
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
      quantity,
      unit: typeof ing.unit === "string" ? ing.unit : undefined,
      ingredient: typeof ing.ingredient === "string" ? ing.ingredient : undefined,
      preparation: typeof ing.preparation === "string" ? ing.preparation : undefined,
      isOptional: typeof ing.optional === "boolean" ? ing.optional : false,
      confidence: Math.max(0, Math.min(1, confidence)),
      confidenceReasons: reasons.length > 0 ? reasons : undefined,
    };
  });
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
