import { parseIngredientLine, splitLeadingQuantity } from "../parsing/ingredient-line";

/**
 * Recipe cards often omit yield. Treat those as a 4-serving card so a plan
 * entry's servings still produce a stored `scaleFactor`.
 */
export const DEFAULT_RECIPE_SERVINGS = 4;

/**
 * Persistable scale for a meal-plan entry: entry servings / recipe servings.
 * Matches shopping-list scaling so the stored value and the list agree.
 * When the entry has no servings, `defaultCookFor` (household Default servings)
 * is used instead of treating the line as 1x recipe yield.
 */
export function scaleFactorForPlanEntry(
  entryServings?: number | null,
  recipeServings?: number | null,
  scaleFactor?: number | null,
  defaultCookFor?: number | null
): number {
  const base = recipeServings && recipeServings > 0 ? recipeServings : DEFAULT_RECIPE_SERVINGS;
  if (entryServings && entryServings > 0) {
    return roundScaleFactor(entryServings / base);
  }
  if (defaultCookFor && defaultCookFor > 0) {
    return roundScaleFactor(defaultCookFor / base);
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
  [5, 6],
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

type UnitFamily = Array<{ unit: string; toBase: number }>;

const UNIT_FAMILIES: UnitFamily[] = [
  [
    { unit: "tsp", toBase: 1 },
    { unit: "tbsp", toBase: 3 },
    { unit: "cup", toBase: 48 },
  ],
  [
    { unit: "ml", toBase: 1 },
    { unit: "l", toBase: 1000 },
  ],
  [
    { unit: "g", toBase: 1 },
    { unit: "kg", toBase: 1000 },
  ],
  [
    { unit: "oz", toBase: 1 },
    { unit: "lb", toBase: 16 },
  ],
];

function cookingFractionDelta(value: number): number {
  const abs = Math.abs(value);
  const whole = Math.floor(abs + 1e-9);
  const frac = abs - whole;
  if (frac < 0.02 || frac > 0.98) return 0;
  let best = 1;
  for (const [num, den] of COOKING_FRACTIONS) {
    best = Math.min(best, Math.abs(frac - num / den));
  }
  return best;
}

function familyFor(unit: string): UnitFamily | undefined {
  return UNIT_FAMILIES.find((family) => family.some((item) => item.unit === unit));
}

function candidateScore(
  quantity: number,
  unit: string,
  originalUnit: string,
  originalQuantity: number,
  toBase: number
): number {
  const delta = cookingFractionDelta(quantity);
  let score = delta;
  if (delta > 0.04) score += 8;
  if (quantity < 0.125) score += 4;
  if (quantity > 24) score += (quantity - 24) * 0.05;
  if (quantity < 1 && unit !== originalUnit) {
    const niceCup = unit === "cup" && delta <= 0.04 && quantity >= 0.125;
    if (!niceCup) score += 1.5;
  }
  if (cookingFractionDelta(originalQuantity) <= 0.02 && unit !== originalUnit && delta > 0.01) {
    score += 6;
  }
  score -= Math.log(toBase) * 0.02;
  if (unit === originalUnit) score -= 0.015;
  return score;
}

export type FriendlyMeasure = {
  displayQuantity: string;
  displayUnit?: string;
};

/**
 * Pick a shoppable unit and cooking-fraction label. Raw `quantity`/`unit`
 * stay unchanged; this is display-only.
 */
export function toFriendlyMeasure(quantity: number, unit?: string | null): FriendlyMeasure {
  if (!Number.isFinite(quantity)) {
    return { displayQuantity: "", displayUnit: unit?.trim() || undefined };
  }
  const normalized = unit?.trim() || undefined;
  if (!normalized) return { displayQuantity: formatQuantity(quantity) };

  const family = familyFor(normalized);
  const from = family?.find((item) => item.unit === normalized);
  if (!family || !from) {
    return { displayQuantity: formatQuantity(quantity), displayUnit: normalized };
  }

  const base = quantity * from.toBase;
  let best = { unit: normalized, quantity, score: Number.POSITIVE_INFINITY };
  for (const candidate of family) {
    const q = base / candidate.toBase;
    const score = candidateScore(q, candidate.unit, normalized, quantity, candidate.toBase);
    if (score < best.score - 1e-9) {
      best = { unit: candidate.unit, quantity: q, score };
    }
  }

  return { displayQuantity: formatQuantity(best.quantity), displayUnit: best.unit };
}

const UNIT_PLURALS: Record<string, string> = {
  cup: "cups",
  tbsp: "tbsp",
  tsp: "tsp",
  oz: "oz",
  lb: "lbs",
  g: "g",
  kg: "kg",
  ml: "ml",
  l: "l",
  clove: "cloves",
  bunch: "bunches",
  pinch: "pinches",
  slice: "slices",
  can: "cans",
  package: "packages",
};

function quantityValue(amount: string): number {
  const parts = amount.trim().split(/\s+/);
  let total = 0;
  for (const part of parts) {
    if (part.includes("/")) {
      const [num, den] = part.split("/").map(Number);
      if (num && den) total += num / den;
      continue;
    }
    const value = Number(part);
    if (!Number.isNaN(value)) total += value;
  }
  return total;
}

export function pluralizeUnit(amount: string, unit: string): string {
  const trimmed = unit.trim();
  if (!trimmed) return amount;
  const quantity = quantityValue(amount);
  if (quantity > 0 && quantity <= 1) return `${amount} ${trimmed}`;
  const lower = trimmed.toLowerCase();
  const plural = UNIT_PLURALS[lower] ?? (trimmed.endsWith("s") ? trimmed : `${trimmed}s`);
  const cased =
    trimmed[0] === trimmed[0]?.toUpperCase() ? plural[0]?.toUpperCase() + plural.slice(1) : plural;
  return `${amount} ${cased}`;
}

const MEASURED_SHOP_UNITS = new Set([
  "tsp",
  "tbsp",
  "cup",
  "ml",
  "l",
  "g",
  "kg",
  "oz",
  "lb",
  "pt",
  "qt",
  "gal",
]);

/** Eggs, cans, whole chickens, and other buy-whole items - not cups or pounds. */
export function isCountableShopItem(unit?: string | null): boolean {
  const normalized = unit?.trim().toLowerCase();
  if (!normalized) return true;
  return !MEASURED_SHOP_UNITS.has(normalized);
}

/** Round countable grocery amounts up to a whole unit so the list never asks for 2/3 can. */
export function wholeShopQuantity(quantity: number): number {
  if (!Number.isFinite(quantity) || quantity <= 0) return quantity;
  const nearest = Math.round(quantity);
  if (Math.abs(quantity - nearest) < 1e-6) return nearest;
  return Math.max(1, Math.ceil(quantity - 1e-9));
}

export function formatMeasureText(quantity: number, unit?: string | null): string {
  const amount = isCountableShopItem(unit) ? wholeShopQuantity(quantity) : quantity;
  const { displayQuantity, displayUnit } = toFriendlyMeasure(amount, unit);
  return displayUnit ? pluralizeUnit(displayQuantity, displayUnit) : displayQuantity;
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
  const canScale = Boolean(fromServings && fromServings > 0 && toServings > 0);
  const from = canScale && fromServings ? fromServings : 1;
  const to = canScale ? toServings : 1;

  const leading = splitLeadingQuantity(ingredient.rawText);
  const quantityMin = ingredient.quantityMin ?? leading.min;
  const quantityMax = ingredient.quantityMax ?? leading.max;
  if (quantityMin == null) return ingredient.rawText;

  const min = formatQuantity(scaleQuantity(quantityMin, from, to));
  const max = quantityMax != null ? formatQuantity(scaleQuantity(quantityMax, from, to)) : null;
  const qty = max ? `${min}-${max}` : min;

  if (leading.min != null) {
    return leading.rest ? `${qty} ${leading.rest}` : qty;
  }

  const parsed = parseIngredientLine(ingredient.rawText);
  const unit = ingredient.unit ?? parsed.unit;
  const name = parsed.name;
  return `${qty}${unit ? ` ${unit}` : ""}${name ? ` ${name}` : ""}`.trim();
}

export function clampServings(value: number, min = 1, max = 24): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, Math.round(value)));
}
