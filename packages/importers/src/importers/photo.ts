/* eslint-disable no-undef */
import { generateObject } from "ai";
import { gateway } from "@ai-sdk/gateway";
import { z } from "zod";
import type {
  Importer,
  PhotoImportInput,
  RawExtraction,
  RecipeDraft,
  ParsedIngredient,
  ParsedStep,
  ImporterConfig,
} from "../types/importer";
import { stripLeadingStepNumber } from "@ovenlovin/core";
import { calculateOverallConfidence, detectMethodTags, extractTimers } from "../utils/confidence";
import { classifyDraftIngredients } from "../utils/classify-allergens";
import { importGenerateOptions, resolveVisionModelId } from "../utils/models";
import { listUncertainFields, type FieldConfidence } from "../utils/uncertain-fields";

const IMPORTER_VERSION = "0.1.0";

function combineAbortSignals(...signals: Array<AbortSignal | undefined>): AbortSignal {
  const list = signals.filter((signal): signal is AbortSignal => Boolean(signal));
  const only = list[0];
  if (list.length === 0 || !only) return AbortSignal.timeout(55_000);
  if (list.length === 1) return only;
  if (typeof AbortSignal.any === "function") return AbortSignal.any(list);
  const controller = new AbortController();
  const abort = () => controller.abort();
  for (const signal of list) {
    if (signal.aborted) {
      controller.abort();
      break;
    }
    signal.addEventListener("abort", abort, { once: true });
  }
  return controller.signal;
}

const ocrConfidence = z.enum(["high", "medium", "low", "illegible"]).describe("Reading confidence");

const recipeSchema = z.object({
  title: z.string().describe("Recipe title"),
  titleConfidence: ocrConfidence.optional().describe("Confidence for the title"),
  description: z.string().optional().describe("Brief description"),
  servings: z.number().int().positive().optional().describe("Number of servings"),
  servingsConfidence: ocrConfidence.optional().describe("Confidence for servings"),
  prepTimeMinutes: z.number().int().nonnegative().optional().describe("Prep time in minutes"),
  cookTimeMinutes: z.number().int().nonnegative().optional().describe("Cook time in minutes"),
  totalTimeMinutes: z.number().int().nonnegative().optional().describe("Total time in minutes"),
  timesConfidence: ocrConfidence.optional().describe("Confidence for prep/cook/total times"),
  notes: z.string().optional().describe("Cook notes, tips, or handwritten margin notes if visible"),
  visibleSource: z
    .string()
    .optional()
    .describe("Cookbook title, author, URL, or card attribution if visible"),
  cuisine: z.string().optional().describe("Cuisine type"),
  course: z.string().optional().describe("Course type"),
  ingredients: z
    .array(
      z.object({
        text: z.string().describe("Full ingredient line exactly as written"),
        quantity: z.string().optional().describe("Quantity if legible"),
        unit: z.string().optional().describe("Unit of measurement if legible"),
        ingredient: z.string().optional().describe("Ingredient name if legible"),
        preparation: z.string().optional().describe("Preparation notes if present"),
        confidence: ocrConfidence,
      })
    )
    .describe("List of ingredients"),
  steps: z
    .array(
      z.object({
        text: z.string().describe("Step instruction text exactly as written"),
        confidence: ocrConfidence,
      })
    )
    .describe("Cooking steps in order"),
  ocrQuality: z.enum(["excellent", "good", "fair", "poor"]).describe("Overall image/text quality"),
  looksLikeRecipe: z
    .boolean()
    .optional()
    .describe("False when the photo is not a recipe card, cookbook page, or recipe screenshot"),
  handwrittenNotes: z
    .string()
    .optional()
    .describe("Notes about handwriting quality or legibility issues"),
});

export function createPhotoImporter(config: ImporterConfig = {}): Importer<PhotoImportInput> {
  const visionModelId = resolveVisionModelId(config.visionModelId);
  const generate = config.generate ?? generateObject;

  return {
    name: "photo-importer",
    version: IMPORTER_VERSION,
    sourceType: "photo",

    canHandle(input: PhotoImportInput): boolean {
      return input.images.length > 0;
    },

    async extract(input: PhotoImportInput): Promise<RawExtraction> {
      const imageMessages = input.images.map((img) => ({
        type: "image" as const,
        image: img.blob,
      }));

      const handwritingContext = input.isHandwritten
        ? "\n\nIMPORTANT: This is a HANDWRITTEN recipe card. Handwriting recognition is challenging:\n- Mark ingredients/steps as 'illegible' if you cannot read them with high confidence\n- Mark as 'low' confidence for uncertain readings\n- Preserve exact text as written, including quirks\n- Note any legibility issues in handwrittenNotes"
        : "";

      const result = await generate({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        // gateway() uses AI_GATEWAY_API_KEY, then VERCEL_OIDC_TOKEN / OIDC on Vercel.
        model: gateway(visionModelId) as any,
        abortSignal: combineAbortSignals(AbortSignal.timeout(55_000), config.abortSignal),
        ...importGenerateOptions(),
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `Extract a structured recipe from this photo (recipe card, cookbook page, screenshot, or multiple pages of one recipe). Read text EXACTLY as written. Do not invent quantities, times, or steps.${handwritingContext}

Extract:
- title, servings, prep/cook/total times
- ingredients with item name, quantity, and unit when legible
- steps in order
- notes (tips, substitutions, handwritten margin notes)
- visibleSource (cookbook name, author, URL, or card attribution) only if visible

Mark confidence for the title, servings, times, each ingredient, and each step: high (printed/clear), medium (somewhat unclear), low (difficult to read), illegible (cannot read).

Rate overall ocrQuality: excellent (printed, perfect), good (printed, minor issues), fair (handwritten but mostly legible), poor (blurry, cropped, or significant legibility issues).
Set looksLikeRecipe false when the photo is not a recipe (a receipt, landscape, random object, or blank page).`,
              },
              ...imageMessages,
            ],
          },
        ],
        schema: recipeSchema,
      });

      return {
        sourceType: "photo",
        sourceBlobs: input.images.map((img) => img.blob),
        rawData: {
          ...(result.object as object),
          isHandwritten: input.isHandwritten,
          imageCount: input.images.length,
        } as Record<string, unknown>,
        extractedAt: new Date(),
        extractorVersion: IMPORTER_VERSION,
        modelUsed: visionModelId,
      };
    },

    async toDraft(raw: RawExtraction): Promise<RecipeDraft> {
      const recipe = raw.rawData;
      const isHandwritten = Boolean(recipe.isHandwritten);

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
      const visibleSource =
        typeof recipe.visibleSource === "string" && recipe.visibleSource.trim()
          ? recipe.visibleSource.trim()
          : undefined;

      const ocrQuality = typeof recipe.ocrQuality === "string" ? recipe.ocrQuality : "unknown";
      const handwrittenNotes =
        typeof recipe.handwrittenNotes === "string" ? recipe.handwrittenNotes : undefined;
      const titleConfidence = asFieldConfidence(recipe.titleConfidence);
      const servingsConfidence = asFieldConfidence(recipe.servingsConfidence);
      const timesConfidence = asFieldConfidence(recipe.timesConfidence);

      const ingredients = parseIngredientsWithOCR(recipe.ingredients, isHandwritten, ocrQuality);
      const steps = parseStepsWithOCR(recipe.steps, isHandwritten, ocrQuality);

      const methodTags = detectMethodTags(
        ingredients.map((i) => i.rawText),
        steps.map((s) => s.text)
      );

      const reviewReasons: string[] = [];
      if (isHandwritten) {
        reviewReasons.push("Handwritten recipe card - verify OCR accuracy");
      }
      if (ocrQuality === "poor" || ocrQuality === "fair") {
        reviewReasons.push(`OCR quality: ${ocrQuality}`);
      }
      if (handwrittenNotes) {
        reviewReasons.push(`Legibility notes: ${handwrittenNotes}`);
      }

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
          type: "photo" as const,
          url: visibleSource?.startsWith("http") ? visibleSource : undefined,
          attribution: visibleSource,
          blobRefs: ((raw.sourceBlobs || []) as string[]).filter(
            (blob) => blob.startsWith("http://") || blob.startsWith("https://")
          ),
          importerName: "photo-importer",
          importerVersion: IMPORTER_VERSION,
          modelUsed: raw.modelUsed,
          rawExtractionJson: raw.rawData,
          licenseNote: isHandwritten
            ? "Personal/family recipe - for private use"
            : "Cookbook/printed recipe - personal use only",
        },
      };

      const confidenceResult = calculateOverallConfidence(draftWithoutConfidence);
      const uncertainFields = listUncertainFields(draftWithoutConfidence, {
        titleConfidence,
        servingsConfidence,
        timesConfidence,
      });
      const allergenClassifications = classifyDraftIngredients(ingredients);

      if (uncertainFields.length > 0) {
        reviewReasons.push(`Uncertain fields: ${uncertainFields.join(", ")}`);
      }

      return {
        ...draftWithoutConfidence,
        overallConfidence: confidenceResult.overallConfidence,
        needsReview: true,
        reviewReasons: [...new Set([...reviewReasons, ...confidenceResult.reviewReasons])],
        uncertainFields,
        allergenClassifications,
      };
    },
  };
}

function asFieldConfidence(value: unknown): FieldConfidence | undefined {
  if (value === "high" || value === "medium" || value === "low" || value === "illegible") {
    return value;
  }
  return undefined;
}

function parseIngredientsWithOCR(
  ingredientsData: unknown,
  isHandwritten: boolean,
  ocrQuality: string
): ParsedIngredient[] {
  if (!Array.isArray(ingredientsData)) return [];

  return ingredientsData.map((item) => {
    if (typeof item !== "object" || item === null) {
      return {
        rawText: String(item),
        confidence: 0.3,
        confidenceReasons: ["Invalid ingredient format"],
      };
    }

    const ing = item as Record<string, unknown>;
    const rawText = typeof ing.text === "string" ? ing.text : "";
    const ocrConfidence = typeof ing.confidence === "string" ? ing.confidence : "low";

    let confidence = 0.85;
    const reasons: string[] = [];

    if (ocrConfidence === "illegible") {
      confidence = 0.2;
      reasons.push("Illegible text in source");
    } else if (ocrConfidence === "low") {
      confidence = 0.45;
      reasons.push("Low OCR confidence");
    } else if (ocrConfidence === "medium") {
      confidence = 0.65;
      reasons.push("Medium OCR confidence");
    } else {
      confidence = 0.85;
    }

    if (isHandwritten) {
      confidence = Math.max(0.1, confidence - 0.15);
      if (!reasons.some((r) => r.includes("handwritten"))) {
        reasons.push("Handwritten text");
      }
    }

    if (ocrQuality === "poor") {
      confidence = Math.max(0.1, confidence - 0.2);
      if (!reasons.some((r) => r.includes("Poor image quality"))) {
        reasons.push("Poor image quality");
      }
    } else if (ocrQuality === "fair") {
      confidence = Math.max(0.1, confidence - 0.1);
      if (!reasons.some((r) => r.includes("OCR quality: fair"))) {
        reasons.push("OCR quality: fair");
      }
    }

    const hasQuantity = typeof ing.quantity === "string" && ing.quantity.length > 0;
    const hasIngredient = typeof ing.ingredient === "string" && ing.ingredient.length > 0;

    if (!hasQuantity) {
      confidence = Math.max(0.1, confidence - 0.05);
      reasons.push("Missing or unclear quantity");
    }

    if (!hasIngredient) {
      confidence = Math.max(0.1, confidence - 0.05);
      reasons.push("Missing or unclear ingredient name");
    }

    return {
      rawText,
      quantity: hasQuantity ? parseQuantityString(ing.quantity as string) : undefined,
      unit: typeof ing.unit === "string" ? ing.unit : undefined,
      ingredient: typeof ing.ingredient === "string" ? ing.ingredient : undefined,
      preparation: typeof ing.preparation === "string" ? ing.preparation : undefined,
      confidence: Math.max(0, Math.min(1, confidence)),
      confidenceReasons: reasons.length > 0 ? reasons : undefined,
    };
  });
}

function parseStepsWithOCR(
  stepsData: unknown,
  isHandwritten: boolean,
  ocrQuality: string
): ParsedStep[] {
  if (!Array.isArray(stepsData)) return [];

  return stepsData.map((item, index) => {
    if (typeof item !== "object" || item === null) {
      return {
        text: String(item),
        order: index,
        confidence: 0.3,
        confidenceReasons: ["Invalid step format"],
      };
    }

    const step = item as Record<string, unknown>;
    const text = typeof step.text === "string" ? stripLeadingStepNumber(step.text) : "";
    const ocrConfidence = typeof step.confidence === "string" ? step.confidence : "low";

    let confidence = 0.85;
    const reasons: string[] = [];

    if (ocrConfidence === "illegible") {
      confidence = 0.2;
      reasons.push("Illegible text in source");
    } else if (ocrConfidence === "low") {
      confidence = 0.45;
      reasons.push("Low OCR confidence");
    } else if (ocrConfidence === "medium") {
      confidence = 0.65;
      reasons.push("Medium OCR confidence");
    } else {
      confidence = 0.85;
    }

    if (isHandwritten) {
      confidence = Math.max(0.1, confidence - 0.15);
      if (!reasons.some((r) => r.includes("handwritten"))) {
        reasons.push("Handwritten text");
      }
    }

    if (ocrQuality === "poor") {
      confidence = Math.max(0.1, confidence - 0.2);
      reasons.push("Poor image quality");
    } else if (ocrQuality === "fair") {
      confidence = Math.max(0.1, confidence - 0.1);
    }

    if (text.length < 10) {
      confidence = Math.max(0.1, confidence - 0.1);
      reasons.push("Very short step");
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
