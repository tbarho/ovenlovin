import type {
  Importer,
  UrlImportInput,
  RawExtraction,
  RecipeDraft,
  ParsedIngredient,
  ParsedStep,
} from "../types/importer";
import { parseIngredientLine } from "@ovenlovin/core";
import {
  fetchHtml,
  extractJsonLd,
  parseDuration,
  extractAuthor,
  extractPageImages,
  pickImportRecipeImage,
} from "../utils/url";
import {
  parseRecipeNotes,
  parseRecipeNutrition,
  parseRecipeServings,
  stripTrailingRecipeWord,
} from "../utils/recipe-ld";
import { calculateOverallConfidence, detectMethodTags, extractTimers } from "../utils/confidence";

const IMPORTER_VERSION = "0.1.0";

export function createUrlImporter(): Importer<UrlImportInput> {
  return {
    name: "url-importer",
    version: IMPORTER_VERSION,
    sourceType: "url",

    canHandle(input: UrlImportInput): boolean {
      try {
        // eslint-disable-next-line no-undef
        const url = new URL(input.url);
        return url.protocol === "http:" || url.protocol === "https:";
      } catch {
        return false;
      }
    },

    async extract(input: UrlImportInput): Promise<RawExtraction> {
      const { html, finalUrl } = await fetchHtml(input.url);
      const jsonLd = extractJsonLd(html);

      if (!jsonLd) {
        throw new Error("No schema.org Recipe JSON-LD found on page");
      }

      return {
        sourceType: "url",
        sourceUrl: finalUrl,
        pageImages: extractPageImages(html),
        author: extractAuthor(jsonLd),
        attribution: jsonLd.publisher
          ? typeof jsonLd.publisher === "string"
            ? jsonLd.publisher
            : typeof jsonLd.publisher === "object" &&
                jsonLd.publisher !== null &&
                "name" in jsonLd.publisher
              ? String((jsonLd.publisher as { name: unknown }).name)
              : undefined
          : undefined,
        rawData: jsonLd,
        extractedAt: new Date(),
        extractorVersion: IMPORTER_VERSION,
      };
    },

    async toDraft(raw: RawExtraction): Promise<RecipeDraft> {
      const recipe = raw.rawData;

      const title = typeof recipe.name === "string" ? stripTrailingRecipeWord(recipe.name) : "";
      const description = typeof recipe.description === "string" ? recipe.description : undefined;

      const servings = parseRecipeServings(recipe);
      const nutrition = parseRecipeNutrition(recipe);
      const notes = parseRecipeNotes(recipe);

      const prepTime = parseDuration(recipe.prepTime as string);
      const cookTime = parseDuration(recipe.cookTime as string);
      const totalTime = parseDuration(recipe.totalTime as string);

      const ingredients = parseIngredients(recipe.recipeIngredient);
      const steps = parseSteps(recipe.recipeInstructions);

      const mainImage = pickImportRecipeImage(recipe, raw.pageImages);
      const images = mainImage ? [mainImage] : [];

      const cuisine =
        typeof recipe.recipeCuisine === "string"
          ? recipe.recipeCuisine
          : Array.isArray(recipe.recipeCuisine) && recipe.recipeCuisine.length > 0
            ? String(recipe.recipeCuisine[0])
            : undefined;

      const course =
        typeof recipe.recipeCategory === "string"
          ? recipe.recipeCategory
          : Array.isArray(recipe.recipeCategory) && recipe.recipeCategory.length > 0
            ? String(recipe.recipeCategory[0])
            : undefined;

      const methodTags = detectMethodTags(
        ingredients.map((i) => i.rawText),
        steps.map((s) => s.text)
      );

      const draftWithoutConfidence = {
        title,
        description,
        servings,
        notes,
        nutrition,
        prepTimeMinutes: prepTime,
        cookTimeMinutes: cookTime,
        totalTimeMinutes: totalTime,
        cuisine,
        course,
        methodTags,
        images,
        ingredients,
        steps,
        source: {
          type: "url" as const,
          url: raw.sourceUrl,
          canonicalUrl: raw.sourceUrl,
          author: raw.author,
          attribution: raw.attribution,
          importerName: "url-importer",
          importerVersion: IMPORTER_VERSION,
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

function parseIngredients(recipeIngredient: unknown): ParsedIngredient[] {
  if (!recipeIngredient) return [];

  const ingredientStrings: string[] = [];

  if (typeof recipeIngredient === "string") {
    ingredientStrings.push(recipeIngredient);
  } else if (Array.isArray(recipeIngredient)) {
    for (const item of recipeIngredient) {
      if (typeof item === "string") {
        ingredientStrings.push(item);
      } else if (typeof item === "object" && item !== null && "text" in item) {
        ingredientStrings.push(String(item.text));
      }
    }
  }

  return ingredientStrings.map((rawText) => {
    const parsed = parseIngredientLine(rawText);
    return {
      rawText,
      quantity:
        parsed.quantityMin != null
          ? { min: parsed.quantityMin, max: parsed.quantityMax ?? undefined }
          : undefined,
      unit: parsed.unit ?? undefined,
      confidence: 1.0,
    };
  });
}

function parseSteps(recipeInstructions: unknown): ParsedStep[] {
  if (!recipeInstructions) return [];

  const stepStrings: string[] = [];

  if (typeof recipeInstructions === "string") {
    stepStrings.push(recipeInstructions);
  } else if (Array.isArray(recipeInstructions)) {
    for (const item of recipeInstructions) {
      if (typeof item === "string") {
        stepStrings.push(item);
      } else if (typeof item === "object" && item !== null) {
        const obj = item as Record<string, unknown>;
        if (obj["@type"] === "HowToStep" && typeof obj.text === "string") {
          stepStrings.push(obj.text);
        } else if (obj["@type"] === "HowToSection" && Array.isArray(obj.itemListElement)) {
          for (const step of obj.itemListElement) {
            if (
              typeof step === "object" &&
              step !== null &&
              "text" in step &&
              typeof step.text === "string"
            ) {
              stepStrings.push(step.text);
            }
          }
        }
      }
    }
  }

  return stepStrings.map((text, index) => ({
    text,
    order: index,
    timers: extractTimers(text),
    confidence: 1.0,
  }));
}
