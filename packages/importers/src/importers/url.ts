/* eslint-disable no-undef */
import type {
  Importer,
  ImporterConfig,
  UrlImportInput,
  RawExtraction,
  RecipeDraft,
  ParsedIngredient,
  ParsedStep,
} from "../types/importer";
import { classifyImportFailure, parseIngredientLine } from "@ovenlovin/core";
import {
  fetchHtml,
  extractJsonLd,
  parseDuration,
  extractAuthor,
  extractPageImages,
  pickImportRecipeImage,
  RecipeNotFoundError,
  RecipeImportFetchError,
  RecipePageGoneError,
  RecipePagePrivateError,
  RecipeUnsupportedSiteError,
  isUnsupportedImportUrl,
  looksLikeBotChallenge,
  looksLikeGonePage,
  looksLikeSignInPage,
  looksLikeSignInUrl,
  looksLikeSoftBlock,
} from "../utils/url";
import { extractHtmlRecipe, parseHtmlRecipeServings } from "../utils/html-recipe";
import { extractRecipeWithLlm } from "../utils/llm-recipe";
import { pageTextFromHtml } from "../utils/page-text";
import {
  cleanImportedIngredientLine,
  cleanImportedTitle,
  parseRecipeNotes,
  parseRecipeNutrition,
  parseRecipeServings,
} from "../utils/recipe-ld";
import { calculateOverallConfidence, detectMethodTags, extractTimers } from "../utils/confidence";
import { decodeHtmlEntities } from "../utils/decode-html";

const IMPORTER_VERSION = "0.1.0";

export function createUrlImporter(config: ImporterConfig = {}): Importer<UrlImportInput> {
  return {
    name: "url-importer",
    version: IMPORTER_VERSION,
    sourceType: "url",

    canHandle(input: UrlImportInput): boolean {
      try {
        const url = new URL(input.url);
        return url.protocol === "http:" || url.protocol === "https:";
      } catch {
        return false;
      }
    },

    async extract(input: UrlImportInput): Promise<RawExtraction> {
      if (isUnsupportedImportUrl(input.url)) {
        throw new RecipeUnsupportedSiteError(input.url);
      }
      const startedAt = Date.now();
      const captured = Boolean(input.html?.trim() || input.jsonLd);
      let html = "";
      let finalUrl = input.url;
      let layersTried: string[] = captured ? ["device"] : [];
      let via = captured ? "device" : "direct";
      let directStatus: number | undefined;
      let directBlocked = false;

      try {
        if (!captured) {
          const fetched = await fetchHtml(input.url, { startedAt });
          html = fetched.html;
          finalUrl = fetched.finalUrl;
          layersTried = fetched.layersTried;
          via = fetched.via;
          directStatus = fetched.directStatus;
          directBlocked = fetched.directBlocked;
        } else {
          html = input.html ?? "";
        }
        if (looksLikeBotChallenge(html) || looksLikeSoftBlock(html)) {
          throw new RecipeImportFetchError(finalUrl, 403, "Forbidden", layersTried);
        }
        if (looksLikeSignInPage(html) || looksLikeSignInUrl(finalUrl)) {
          throw new RecipePagePrivateError(finalUrl);
        }
        if (looksLikeGonePage(html)) {
          throw new RecipePageGoneError(finalUrl);
        }
        const jsonLd =
          (input.jsonLd
            ? extractJsonLd(
                `<script type="application/ld+json">${JSON.stringify(input.jsonLd)}</script>`
              )
            : null) ?? extractJsonLd(html);
        const htmlRecipe = jsonLd ? null : extractHtmlRecipe(html);
        let structured =
          jsonLd ??
          htmlRecipe ??
          (await (config.extractWithLlm
            ? config.extractWithLlm(pageTextFromHtml(html))
            : extractRecipeWithLlm(pageTextFromHtml(html), {
                modelId: config.modelId,
                startedAt,
              })));

        if (!structured) {
          throw new RecipeNotFoundError(finalUrl, layersTried, directBlocked);
        }

        if (parseRecipeServings(structured) == null) {
          const htmlServings = parseHtmlRecipeServings(html);
          if (htmlServings != null) {
            structured = { ...structured, recipeYield: htmlServings };
          }
        }

        console.info(
          `import_url url=${importLogUrl(input.url)} directStatus=${directStatus ?? "-"} via=${via} reason=imported`
        );
        return {
          sourceType: "url",
          sourceUrl: finalUrl,
          pageImages: extractPageImages(html),
          author: decodeOptionalText(extractAuthor(structured)),
          attribution: structured.publisher
            ? typeof structured.publisher === "string"
              ? decodeHtmlEntities(structured.publisher)
              : typeof structured.publisher === "object" &&
                  structured.publisher !== null &&
                  "name" in structured.publisher
                ? decodeHtmlEntities(String((structured.publisher as { name: unknown }).name))
                : undefined
            : undefined,
          rawData: structured,
          extractedAt: new Date(),
          extractorVersion: IMPORTER_VERSION,
          modelUsed: jsonLd || htmlRecipe ? undefined : config.modelId,
        };
      } catch (error) {
        if (directBlocked && error && typeof error === "object") {
          Object.assign(error, { directBlocked: true, directStatus });
        }
        const status =
          directStatus ??
          (error &&
          typeof error === "object" &&
          typeof (error as { status?: unknown }).status === "number"
            ? (error as { status: number }).status
            : undefined);
        const reason =
          classifyImportFailure(error)?.code ?? (error instanceof Error ? error.name : "error");
        console.info(
          `import_url url=${importLogUrl(input.url)} directStatus=${status ?? "-"} via=${via} reason=${reason}`
        );
        throw error;
      }
    },

    async toDraft(raw: RawExtraction): Promise<RecipeDraft> {
      const recipe = raw.rawData;

      const title =
        typeof recipe.name === "string" ? cleanImportedTitle(decodeHtmlEntities(recipe.name)) : "";
      const description =
        typeof recipe.description === "string" ? decodeHtmlEntities(recipe.description) : undefined;

      const servings = parseRecipeServings(recipe);
      const nutrition = parseRecipeNutrition(recipe);
      const notes = decodeOptionalText(parseRecipeNotes(recipe));

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

function importLogUrl(url: string): string {
  try {
    const parsed = new URL(url);
    return `${parsed.host}${parsed.pathname}`;
  } catch {
    return "-";
  }
}

function decodeOptionalText(value: string | undefined): string | undefined {
  return value == null ? value : decodeHtmlEntities(value);
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

  return ingredientStrings.map((line) => {
    const rawText = cleanImportedIngredientLine(decodeHtmlEntities(line));
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

  return stepStrings.map((line, index) => {
    const text = decodeHtmlEntities(line);
    return {
      text,
      order: index,
      timers: extractTimers(text),
      confidence: 1.0,
    };
  });
}
