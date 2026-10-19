/**
 * Schema.org Recipe JSON-LD helpers.
 *
 * recipeYield is not a single type: sites send a number, "6 servings",
 * ["6", "6 servings"], or a QuantitativeValue. NutritionInformation
 * quantities are usually "250 calories" / "12 g".
 */

export type ImportedNutrition = {
  perServing: boolean;
  calories?: number;
  protein?: number;
  carbohydrates?: number;
  fat?: number;
  fiber?: number;
  sugar?: number;
  sodium?: number;
};

export { cleanImportedTitle, stripTrailingRecipeWord } from "@ovenlovin/core";

function positiveInt(value: number): number | undefined {
  if (!Number.isFinite(value) || value <= 0) return undefined;
  return Math.round(value);
}

function firstNumberInText(text: string): number | undefined {
  const match = text.match(/(\d+(?:\.\d+)?)/);
  if (!match?.[1]) return undefined;
  return positiveInt(Number(match[1]));
}

function servingsFromValue(value: unknown): number | undefined {
  if (typeof value === "number") return positiveInt(value);
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return undefined;
    const labeled = trimmed.match(/(?:serves?|yield|makes?|about)\s+(\d+(?:\.\d+)?)/i);
    if (labeled?.[1]) return positiveInt(Number(labeled[1]));
    return firstNumberInText(trimmed);
  }
  if (typeof value === "object" && value !== null) {
    const obj = value as Record<string, unknown>;
    return (
      servingsFromValue(obj.value) ??
      servingsFromValue(obj.minValue) ??
      servingsFromValue(obj.maxValue) ??
      servingsFromValue(obj.name)
    );
  }
  return undefined;
}

/**
 * Parse schema.org recipeYield (and yield) into a servings integer.
 */
export function parseRecipeServings(recipe: Record<string, unknown>): number | undefined {
  const raw = recipe.recipeYield ?? recipe.yield;
  if (raw == null) return undefined;
  const candidates = Array.isArray(raw) ? raw : [raw];
  for (const candidate of candidates) {
    const servings = servingsFromValue(candidate);
    if (servings != null) return servings;
  }
  return undefined;
}

function nutritionNumber(value: unknown): number | undefined {
  if (typeof value === "number") {
    return Number.isFinite(value) && value >= 0 ? value : undefined;
  }
  if (typeof value === "string") {
    const match = value.replace(/,/g, "").match(/(\d+(?:\.\d+)?)/);
    if (!match?.[1]) return undefined;
    const n = Number(match[1]);
    return Number.isFinite(n) && n >= 0 ? n : undefined;
  }
  if (typeof value === "object" && value !== null) {
    const obj = value as Record<string, unknown>;
    return nutritionNumber(obj.value) ?? nutritionNumber(obj.calories);
  }
  return undefined;
}

function asNutritionObject(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== "object") return undefined;
  if (Array.isArray(value)) {
    for (const item of value) {
      const obj = asNutritionObject(item);
      if (obj) return obj;
    }
    return undefined;
  }
  return value as Record<string, unknown>;
}

/**
 * Parse schema.org NutritionInformation when present.
 */
export function parseRecipeNutrition(
  recipe: Record<string, unknown>
): ImportedNutrition | undefined {
  const nutrition = asNutritionObject(recipe.nutrition);
  if (!nutrition) return undefined;

  const parsed: ImportedNutrition = {
    perServing: true,
  };
  const calories = nutritionNumber(nutrition.calories);
  const protein = nutritionNumber(nutrition.proteinContent);
  const carbohydrates = nutritionNumber(nutrition.carbohydrateContent);
  const fat = nutritionNumber(nutrition.fatContent);
  const fiber = nutritionNumber(nutrition.fiberContent);
  const sugar = nutritionNumber(nutrition.sugarContent);
  const sodium = nutritionNumber(nutrition.sodiumContent);

  if (calories != null) parsed.calories = calories;
  if (protein != null) parsed.protein = protein;
  if (carbohydrates != null) parsed.carbohydrates = carbohydrates;
  if (fat != null) parsed.fat = fat;
  if (fiber != null) parsed.fiber = fiber;
  if (sugar != null) parsed.sugar = sugar;
  if (sodium != null) parsed.sodium = sodium;

  if (
    parsed.calories == null &&
    parsed.protein == null &&
    parsed.carbohydrates == null &&
    parsed.fat == null &&
    parsed.fiber == null &&
    parsed.sugar == null &&
    parsed.sodium == null
  ) {
    return undefined;
  }

  return parsed;
}

function notesFromValue(value: unknown): string | undefined {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }
  if (Array.isArray(value)) {
    const parts = value
      .map((item) => notesFromValue(item))
      .filter((item): item is string => Boolean(item));
    return parts.length > 0 ? parts.join("\n") : undefined;
  }
  return undefined;
}

export function parseRecipeNotes(recipe: Record<string, unknown>): string | undefined {
  return (
    notesFromValue(recipe.notes) ??
    notesFromValue(recipe.recipeNotes) ??
    notesFromValue(recipe.comment)
  );
}
