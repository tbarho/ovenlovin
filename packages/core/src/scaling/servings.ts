import { parseIngredientLine } from "../parsing/ingredient-line";

/**
 * Recipe cards often omit yield. Treat those as a 4-serving card so a plan
 * entry's servings still produce a stored `scaleFactor`.
 */
export const DEFAULT_RECIPE_SERVINGS = 4;

/**
 * Persistable scale for a meal-plan entry: entry servings / recipe servings.
 * Matches shopping-list scaling so the stored value and the list agree.
 */
export function scaleFactorForPlanEntry(
  entryServings?: number | null,
  recipeServings?: number | null,
  scaleFactor?: number | null
): number {
  if (entryServings && entryServings > 0) {
    const base = recipeServings && recipeServings > 0 ? recipeServings : DEFAULT_RECIPE_SERVINGS;
    return roundScaleFactor(entryServings / base);
  }
  if (scaleFactor && scaleFactor > 0) return roundScaleFactor(scaleFactor);
  return 1;
}

function roundScaleFactor(value: number): number {
  return Math.round(value * 10000) / 10000;
}

const COOKING_FRACTIONS: Array<[number, number]> = [
  [1, 8],
  [1, 6],
  [1, 4],
  [1, 3],
  [3, 8],
  [1, 2],
  [5, 8],
  [2, 3],
  [3, 4],
  [7, 8],
];

export function scaleQuantity(quantity: number, fromServings: number, toServings: number): number {
  if (fromServings <= 0 || toServings <= 0) return quantity;
  return quantity * (toServings / fromServings);
}

export function formatQuantity(value: number): string {
  if (!Number.isFinite(value)) return "";
  if (Math.abs(value) < 1e-9) return "0";

  const sign = value < 0 ? "-" : "";
  const abs = Math.abs(value);
  const whole = Math.floor(abs + 1e-9);
  const frac = abs - whole;

  if (frac < 0.02) {
    return `${sign}${whole}`;
  }

  let best = frac;
  let label = "";
  let bestDelta = 1;
  for (const [num, den] of COOKING_FRACTIONS) {
    const candidate = num / den;
    const delta = Math.abs(frac - candidate);
    if (delta < bestDelta - 1e-9) {
      bestDelta = delta;
      best = candidate;
      label = `${num}/${den}`;
    }
  }

  if (bestDelta > 0.04) {
    const rounded = Math.round(abs * 100) / 100;
    return `${sign}${Number.isInteger(rounded) ? String(rounded) : String(rounded)}`;
  }

  if (Math.abs(best - 1) < 1e-9) {
    return `${sign}${whole + 1}`;
  }

  return whole > 0 ? `${sign}${whole} ${label}` : `${sign}${label}`;
}

export function formatDurationMinutes(minutes: number | null | undefined): string | null {
  if (minutes == null || !Number.isFinite(minutes) || minutes < 0) return null;
  const total = Math.round(minutes);
  if (total < 60) return `${total} min`;
  const hours = Math.floor(total / 60);
  const rest = total % 60;
  if (rest === 0) return hours === 1 ? "1 hr" : `${hours} hr`;
  return `${hours} hr ${rest} min`;
}

export type ScalableIngredient = {
  rawText: string;
  quantityMin?: number | null;
  quantityMax?: number | null;
  unit?: string | null;
};

export function scaleIngredientDisplay(
  ingredient: ScalableIngredient,
  fromServings: number | null | undefined,
  toServings: number
): string {
  const base = fromServings && fromServings > 0 ? fromServings : null;
  if (!base || base === toServings) return ingredient.rawText;

  const parsed =
    ingredient.quantityMin != null
      ? {
          quantityMin: ingredient.quantityMin,
          quantityMax: ingredient.quantityMax ?? null,
          unit: ingredient.unit ?? null,
          name: parseIngredientLine(ingredient.rawText).name,
        }
      : parseIngredientLine(ingredient.rawText);

  if (parsed.quantityMin == null) return ingredient.rawText;

  const min = formatQuantity(scaleQuantity(parsed.quantityMin, base, toServings));
  const max =
    parsed.quantityMax != null
      ? formatQuantity(scaleQuantity(parsed.quantityMax, base, toServings))
      : null;
  const qty = max ? `${min}–${max}` : min;
  const unit = parsed.unit ? ` ${parsed.unit}` : "";
  const name = parsed.name ? ` ${parsed.name}` : "";
  return `${qty}${unit}${name}`.trim();
}

export function clampServings(value: number, min = 1, max = 24): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, Math.round(value)));
}
