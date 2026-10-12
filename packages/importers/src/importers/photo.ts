/* eslint-disable no-undef */
import { generateObject } from "ai";
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
import { calculateOverallConfidence, detectMethodTags, extractTimers } from "../utils/confidence";

const IMPORTER_VERSION = "0.1.0";

const recipeSchema = z.object({
  title: z.string().describe("Recipe title"),
  description: z.string().optional().describe("Brief description"),
  servings: z.number().int().positive().optional().describe("Number of servings"),
  prepTimeMinutes: z.number().int().nonnegative().optional().describe("Prep time in minutes"),
  cookTimeMinutes: z.number().int().nonnegative().optional().describe("Cook time in minutes"),
  totalTimeMinutes: z.number().int().nonnegative().optional().describe("Total time in minutes"),
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
        confidence: z
          .enum(["high", "medium", "low", "illegible"])
          .describe("Reading confidence"),
      })
    )
    .describe("List of ingredients"),
  steps: z
    .array(
      z.object({
        text: z.string().describe("Step instruction text exactly as written"),
        confidence: z
          .enum(["high", "medium", "low", "illegible"])
          .describe("Reading confidence"),
      })
    )
    .describe("Cooking steps in order"),
  ocrQuality: z
    .enum(["excellent", "good", "fair", "poor"])
    .describe("Overall image/text quality"),
  handwrittenNotes: z
    .string()
    .optional()
    .describe("Notes about handwriting quality or legibility issues"),
});

export function createPhotoImporter(config: ImporterConfig = {}): Importer<PhotoImportInput> {
  const visionModelId =
    config.visionModelId || process.env.RK_MODEL_VISION || "xai/grok-vision-latest";

  return {
    name: "photo-importer",
    version: IMPORTER_VERSION,
    sourceType: "photo",

    canHandle(input: PhotoImportInput): boolean {
      return input.images.length > 0;
    },

    async extract(input: PhotoImportInput): Promise<RawExtraction> {
      const { createOpenAI } = await import("@ai-sdk/openai");
      const apiKey = process.env.AI_GATEWAY_API_KEY;
      if (!apiKey) {
        throw new Error("AI_GATEWAY_API_KEY environment variable is required");
      }

      const openai = createOpenAI({
        apiKey,
        baseURL: "https://gateway.ai.cloudflare.com/v1",
      });

      const imageMessages = input.images.map((img) => ({
        type: "image" as const,
        image: img.blob,
      }));

      const handwritingContext = input.isHandwritten
        ? "\n\nIMPORTANT: This is a HANDWRITTEN recipe card. Handwriting recognition is challenging:\n- Mark ingredients/steps as 'illegible' if you cannot read them with high confidence\n- Mark as 'low' confidence for uncertain readings\n- Preserve exact text as written, including quirks\n- Note any legibility issues in handwrittenNotes"
        : "";

      const result = await generateObject({
        model: openai(visionModelId),
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `Extract recipe data from this image. Read text EXACTLY as written. Mark confidence for each ingredient and step.${handwritingContext}\n\nFor ingredients, extract:\n- Full text line as written\n- Quantity, unit, ingredient name only if clearly legible\n- Mark confidence: high (printed/clear), medium (somewhat unclear), low (difficult to read), illegible (cannot read)\n\nFor steps, extract text and mark confidence.\n\nRate overall ocrQuality: excellent (printed, perfect), good (printed, minor issues), fair (handwritten but mostly legible), poor (handwritten, significant legibility issues)`,
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
          ...result.object,
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

      const ocrQuality =
        typeof recipe.ocrQuality === "string" ? recipe.ocrQuality : "unknown";
      const handwrittenNotes =
        typeof recipe.handwrittenNotes === "string" ? recipe.handwrittenNotes : undefined;

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
        methodTags,
        ingredients,
        steps,
        source: {
          type: "photo" as const,
          blobRefs: (raw.sourceBlobs || []) as string[],
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

      return {
        ...draftWithoutConfidence,
        overallConfidence: confidenceResult.overallConfidence,
        needsReview: true,
        reviewReasons: [...new Set([...reviewReasons, ...confidenceResult.reviewReasons])],
      };
    },
  };
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
    const text = typeof step.text === "string" ? step.text : "";
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
