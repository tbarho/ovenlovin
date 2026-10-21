import {
  parseIngredientLine,
  splitLeadingQuantity,
  splitLeadingUnit,
} from "../parsing/ingredient-line";
import { SERVINGS_HARD_MAX, type DefaultServingsMode } from "../schemas/households";
import { effectivePlanServings } from "./default-servings";

export { SERVINGS_HARD_MAX };

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
  scaleFactor?: number | null,
  defaultCookFor?: number | null,
  mode?: DefaultServingsMode
): number {
  const base = recipeServings && recipeServings > 0 ? recipeServings : DEFAULT_RECIPE_SERVINGS;
  const servings = effectivePlanServings({
    entryServings,
    defaultCookFor: defaultCookFor && defaultCookFor > 0 ? defaultCookFor : base,
    mode,
    recipeServings,
    scaleFactor,
  });
  return roundScaleFactor(servings / base);
}

function roundScaleFactor(value: number): number {
  return Math.round(value * 10000) / 10000;
}

/** Kitchen-usable fractions, plus 0 and 1 so near-wholes do not snap to 3/4. */
const FRACTION_STEPS: Array<[number, string]> = [
  [0, ""],
  [1 / 8, "1/8"],
  [1 / 4, "1/4"],
  [1 / 3, "1/3"],
  [1 / 2, "1/2"],
  [2 / 3, "2/3"],
  [3 / 4, "3/4"],
  [1, ""],
];

export function scaleQuantity(quantity: number, fromServings: number, toServings: number): number {
  if (fromServings <= 0 || toServings <= 0) return quantity;
  return quantity * (toServings / fromServings);
}

function nearestFraction(frac: number): { value: number; label: string } {
  let best = FRACTION_STEPS[0] ?? [0, ""];
  let bestDelta = 1;
  for (const step of FRACTION_STEPS) {
    const delta = Math.abs(frac - step[0]);
    if (delta < bestDelta - 1e-9) {
      bestDelta = delta;
      best = step;
    }
  }
  return { value: best[0], label: best[1] };
}

function snapFraction(frac: number, roundUp: boolean): { value: number; label: string } {
  const nearest = nearestFraction(frac);
  // stored 0.6667 and schema.org 2/3 leftovers sit a hair above the step
  if (!roundUp || frac - nearest.value < 1e-4) return nearest;
  for (const [value, label] of FRACTION_STEPS) {
    if (value + 1e-9 >= frac) return { value, label };
  }
  return { value: 1, label: "" };
}

export function formatQuantity(value: number, roundUp = false): string {
  if (!Number.isFinite(value)) return "";
  if (Math.abs(value) < 1e-9) return "0";

  const sign = value < 0 ? "-" : "";
  const abs = Math.abs(value);
  const whole = Math.floor(abs + 1e-9);
  let snapped = snapFraction(abs - whole, roundUp);
  // a leftover closer to 0 than 1/8 used to print as 0 tsp
  if (whole === 0 && snapped.value < 1e-9) snapped = { value: 1 / 8, label: "1/8" };

  if (snapped.value < 1e-9) return `${sign}${whole}`;
  if (Math.abs(snapped.value - 1) < 1e-9) return `${sign}${whole + 1}`;
  return whole > 0 ? `${sign}${whole} ${snapped.label}` : `${sign}${snapped.label}`;
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
  let best = 1;
  for (const [step] of FRACTION_STEPS) {
    best = Math.min(best, Math.abs(frac - step));
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
  toBase: number,
  originalToBase: number
): number {
  const delta = cookingFractionDelta(quantity);
  let score = delta;
  if (quantity < 0.125) score += 4;
  if (quantity > 24) score += (quantity - 24) * 0.05;
  if (quantity < 1 && unit !== originalUnit) {
    const niceCup = unit === "cup" && quantity >= 0.25;
    if (!niceCup) score += 1.5;
  }
  if (unit === "cup" && quantity > 0 && quantity < 0.25) {
    score += 3;
  }
  if (toBase < originalToBase && originalQuantity >= 0.25) score += 8;
  const largeSpoons = (originalUnit === "tbsp" || originalUnit === "tsp") && originalQuantity >= 8;
  if (
    !largeSpoons &&
    cookingFractionDelta(originalQuantity) <= 0.02 &&
    unit !== originalUnit &&
    delta > 0.01
  ) {
    score += 6;
  }
  if (largeSpoons && (unit === "tbsp" || unit === "tsp")) score += 3;
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
function mixedCupTbsp(tbsp: number): FriendlyMeasure | null {
  const cups = tbsp / 16;
  if (cups < 0.25) return null;
  const whole = Math.floor(cups + 1e-9);
  const frac = cups - whole;
  let cupDown = whole;
  for (const [step] of FRACTION_STEPS) {
    if (step <= frac + 1e-9 && step < 1) cupDown = whole + step;
  }
  if (cupDown < 0.25) return null;
  const remTsp = (tbsp - cupDown * 16) * 3;
  if (remTsp < 1 / 8 - 1e-9) return null;
  return {
    displayQuantity: `${formatQuantity(cupDown)} cup + ${formatQuantity(remTsp)} tsp`,
  };
}

export function toFriendlyMeasure(
  quantity: number,
  unit?: string | null,
  roundUp = false
): FriendlyMeasure {
  if (!Number.isFinite(quantity)) {
    return { displayQuantity: "", displayUnit: unit?.trim() || undefined };
  }
  const normalized = unit?.trim() || undefined;
  if (!normalized) return { displayQuantity: formatQuantity(quantity, roundUp) };

  const family = familyFor(normalized);
  const from = family?.find((item) => item.unit === normalized);
  if (!family || !from) {
    return { displayQuantity: formatQuantity(quantity, roundUp), displayUnit: normalized };
  }
  if (normalized === "tsp" && quantity > 0 && quantity < 1 / 16) {
    return { displayQuantity: "a pinch" };
  }

  const base = quantity * from.toBase;
  let best = { unit: normalized, quantity, score: Number.POSITIVE_INFINITY };
  for (const candidate of family) {
    const q = base / candidate.toBase;
    const score = candidateScore(
      q,
      candidate.unit,
      normalized,
      quantity,
      candidate.toBase,
      from.toBase
    );
    if (score < best.score - 1e-9) {
      best = { unit: candidate.unit, quantity: q, score };
    }
  }

  if (normalized === "tbsp" && best.unit === "cup") {
    const cups = quantity / 16;
    const shown = quantityValue(formatQuantity(best.quantity, roundUp));
    if (shown > 0 && Math.abs(shown - cups) / cups <= 0.05) {
      return { displayQuantity: formatQuantity(best.quantity, roundUp), displayUnit: best.unit };
    }
    return (
      mixedCupTbsp(quantity) ?? {
        displayQuantity: formatQuantity(quantity, roundUp),
        displayUnit: "tbsp",
      }
    );
  }

  return { displayQuantity: formatQuantity(best.quantity, roundUp), displayUnit: best.unit };
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
  dash: "dashes",
  sprig: "sprigs",
  stick: "sticks",
  head: "heads",
  piece: "pieces",
};

function quantityValue(amount: string): number {
  const upper = amount.includes("-")
    ? amount.slice(amount.lastIndexOf("-") + 1).trim() || amount
    : amount;
  const parts = upper.trim().split(/\s+/);
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

export function inflectedUnit(amount: string, unit: string): string {
  const trimmed = unit.trim();
  if (!trimmed) return "";
  const formatted = pluralizeUnit(amount, trimmed);
  const prefix = `${amount} `;
  return formatted.startsWith(prefix) ? formatted.slice(prefix.length) : trimmed;
}

export function pluralizeUnit(amount: string, unit: string): string {
  const trimmed = unit.trim();
  if (!trimmed) return amount;
  const quantity = quantityValue(amount);
  const canonical = canonicalUnit(trimmed);
  if (quantity > 0 && quantity <= 1) return `${amount} ${canonical}`;
  const lower = canonical.toLowerCase();
  const plural = UNIT_PLURALS[lower];
  if (!plural) return `${amount} ${canonical}`;
  const cased =
    canonical[0] === canonical[0]?.toUpperCase()
      ? plural[0]?.toUpperCase() + plural.slice(1)
      : plural;
  return `${amount} ${cased}`;
}

function canonicalUnit(unit: string): string {
  const trimmed = unit.trim();
  const lower = trimmed.toLowerCase().replace(/\.$/, "");
  for (const [singular, plural] of Object.entries(UNIT_PLURALS)) {
    if (lower === singular || lower === plural.toLowerCase()) {
      return trimmed[0] === trimmed[0]?.toUpperCase()
        ? singular[0]?.toUpperCase() + singular.slice(1)
        : singular;
    }
  }
  return trimmed.replace(/\.$/, "");
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

export function formatMeasureText(quantity: number, unit?: string | null, roundUp = false): string {
  const amount = isCountableShopItem(unit) ? wholeShopQuantity(quantity) : quantity;
  const { displayQuantity, displayUnit } = toFriendlyMeasure(amount, unit, roundUp);
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

  const size = leading.rest.match(/^(\([^)]+\)\s*)(.*)$/);
  const sizePrefix = size?.[1] ?? "";
  const afterSize = size?.[2] ?? leading.rest;
  const leadingUnit = splitLeadingUnit(afterSize);
  const parsed = parseIngredientLine(ingredient.rawText);
  const unit =
    leading.min != null ? leadingUnit.unit : (ingredient.unit ?? parsed.unit ?? leadingUnit.unit);

  const scaledMin = scaleQuantity(quantityMin, from, to);
  const scaledMax = quantityMax != null ? scaleQuantity(quantityMax, from, to) : null;

  if (scaledMax != null) {
    const minN = isCountableShopItem(unit) ? wholeShopQuantity(scaledMin) : scaledMin;
    const maxN = isCountableShopItem(unit) ? wholeShopQuantity(scaledMax) : scaledMax;
    const qty = `${formatQuantity(minN)}-${formatQuantity(maxN)}`;
    if (leading.min != null) {
      if (leadingUnit.unit) {
        const head = sizePrefix
          ? `${qty} ${sizePrefix}${inflectedUnit(qty, leadingUnit.unit)}`
          : pluralizeUnit(qty, leadingUnit.unit);
        return leadingUnit.rest ? `${head} ${leadingUnit.rest}` : head;
      }
      return leading.rest ? `${qty} ${leading.rest}` : qty;
    }
    const name = parsed.name;
    const measure = unit ? pluralizeUnit(qty, unit) : qty;
    return `${measure}${name ? ` ${name}` : ""}`.trim();
  }

  if (sizePrefix && leadingUnit.unit) {
    const amount = isCountableShopItem(unit) ? wholeShopQuantity(scaledMin) : scaledMin;
    const { displayQuantity, displayUnit } = toFriendlyMeasure(amount, unit);
    const labeled = displayUnit ? inflectedUnit(displayQuantity, displayUnit) : "";
    const head = `${displayQuantity} ${sizePrefix}${labeled}`.trim();
    return leadingUnit.rest ? `${head} ${leadingUnit.rest}` : head;
  }

  const measure = formatMeasureText(scaledMin, unit);
  if (leading.min != null) {
    const rest = leadingUnit.unit
      ? leadingUnit.rest
      : leading.rest.replace(/^(eggs|egg)\b/i, quantityValue(measure) === 1 ? "egg" : "eggs");
    return rest ? `${measure} ${rest}` : measure;
  }
  const name = parsed.name;
  return name ? `${measure} ${name}` : measure;
}

/** Slider and stepper ceiling: at least 24, and at least the recipe or cook-for. */
export function servingsRangeMax(...hints: Array<number | null | undefined>): number {
  let max = 24;
  for (const hint of hints) {
    if (typeof hint === "number" && hint > max) max = Math.round(hint);
  }
  return max;
}

export function clampServings(value: number, min = 1, max = SERVINGS_HARD_MAX): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, Math.round(value)));
}
