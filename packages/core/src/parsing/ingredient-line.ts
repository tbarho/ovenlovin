const UNIT_ALIASES: Array<{ match: string; unit: string }> = [
  { match: "tablespoons", unit: "tbsp" },
  { match: "tablespoon", unit: "tbsp" },
  { match: "tbsp", unit: "tbsp" },
  { match: "tbs", unit: "tbsp" },
  { match: "teaspoons", unit: "tsp" },
  { match: "teaspoon", unit: "tsp" },
  { match: "tsp", unit: "tsp" },
  { match: "cups", unit: "cup" },
  { match: "cup", unit: "cup" },
  { match: "c", unit: "cup" },
  { match: "pounds", unit: "lb" },
  { match: "pound", unit: "lb" },
  { match: "lbs", unit: "lb" },
  { match: "lb", unit: "lb" },
  { match: "ounces", unit: "oz" },
  { match: "ounce", unit: "oz" },
  { match: "oz", unit: "oz" },
  { match: "kilograms", unit: "kg" },
  { match: "kilogram", unit: "kg" },
  { match: "kg", unit: "kg" },
  { match: "grams", unit: "g" },
  { match: "gram", unit: "g" },
  { match: "g", unit: "g" },
  { match: "milliliters", unit: "ml" },
  { match: "milliliter", unit: "ml" },
  { match: "ml", unit: "ml" },
  { match: "liters", unit: "l" },
  { match: "liter", unit: "l" },
  { match: "quarts", unit: "qt" },
  { match: "quart", unit: "qt" },
  { match: "qt", unit: "qt" },
  { match: "pints", unit: "pt" },
  { match: "pint", unit: "pt" },
  { match: "pt", unit: "pt" },
  { match: "gallons", unit: "gal" },
  { match: "gallon", unit: "gal" },
  { match: "gal", unit: "gal" },
  { match: "cloves", unit: "clove" },
  { match: "clove", unit: "clove" },
  { match: "cans", unit: "can" },
  { match: "can", unit: "can" },
  { match: "packages", unit: "package" },
  { match: "package", unit: "package" },
  { match: "pkg", unit: "package" },
  { match: "slices", unit: "slice" },
  { match: "slice", unit: "slice" },
  { match: "pieces", unit: "piece" },
  { match: "piece", unit: "piece" },
  { match: "pinches", unit: "pinch" },
  { match: "pinch", unit: "pinch" },
  { match: "dashes", unit: "dash" },
  { match: "dash", unit: "dash" },
  { match: "sticks", unit: "stick" },
  { match: "stick", unit: "stick" },
  { match: "heads", unit: "head" },
  { match: "head", unit: "head" },
  { match: "bunches", unit: "bunch" },
  { match: "bunch", unit: "bunch" },
  { match: "sprigs", unit: "sprig" },
  { match: "sprig", unit: "sprig" },
];

const UNICODE_FRACTIONS: Record<string, number> = {
  "¼": 0.25,
  "½": 0.5,
  "¾": 0.75,
  "⅓": 1 / 3,
  "⅔": 2 / 3,
  "⅛": 0.125,
  "⅜": 0.375,
  "⅝": 0.625,
  "⅞": 0.875,
};

export type ParsedIngredientLine = {
  rawText: string;
  quantityMin: number | null;
  quantityMax: number | null;
  unit: string | null;
  name: string;
};

/** Trailing notes that are prep, not the grocery item. */
const PREP_NOTES =
  /^(minced|chopped|diced|cubed|sliced|grated|shredded|crushed|optional|divided|softened|melted|trimmed|peeled|seeded|halved|quartered|drained|rinsed|thawed|room temperature|to taste|(finely|thinly|roughly|freshly|coarsely)\s+[\w\s]+)$/i;

export type BackfillableIngredient = {
  rawText: string;
  name?: string | null;
  quantityMin?: number | null;
  quantityMax?: number | null;
  unit?: string | null;
};

export type BackfilledIngredient = {
  name: string;
  quantityMin: number | null;
  quantityMax: number | null;
  unit: string | null;
};

function parseNumberToken(token: string): number | null {
  const unicode = UNICODE_FRACTIONS[token];
  if (unicode != null) return unicode;

  const mixed = token.match(/^(\d+)\s+(\d+)\/(\d+)$/);
  if (mixed?.[1] && mixed[2] && mixed[3]) {
    return Number(mixed[1]) + Number(mixed[2]) / Number(mixed[3]);
  }

  const fraction = token.match(/^(\d+)\/(\d+)$/);
  if (fraction?.[1] && fraction[2]) {
    const denom = Number(fraction[2]);
    if (denom === 0) return null;
    return Number(fraction[1]) / denom;
  }

  if (/^\d+(?:\.\d+)?$/.test(token)) return Number(token);
  return null;
}

/** Split a stored ingredient line into a leading amount and the remaining text. */
export function splitLeadingQuantity(text: string): {
  min: number | null;
  max: number | null;
  rest: string;
} {
  return consumeLeadingQuantity(text.trim());
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const UNIT_ALIASES_BY_LENGTH = [...UNIT_ALIASES].sort((a, b) => b.match.length - a.match.length);

/** Peel a leading unit word (`cups`, `clove`) off the rest of an ingredient line. */
export function splitLeadingUnit(text: string): { unit: string | null; rest: string } {
  const trimmed = text.trim();
  if (!trimmed) return { unit: null, rest: "" };
  for (const alias of UNIT_ALIASES_BY_LENGTH) {
    const pattern = new RegExp(`^${escapeRegExp(alias.match)}\\.?(?=\\s|$)`, "i");
    const match = trimmed.match(pattern);
    if (!match) continue;
    return { unit: alias.unit, rest: trimmed.slice(match[0].length).trim() };
  }
  return { unit: null, rest: trimmed };
}

function consumeLeadingQuantity(text: string): {
  min: number | null;
  max: number | null;
  rest: string;
} {
  const normalized = text
    .replace(/[¼½¾⅓⅔⅛⅜⅝⅞]/g, (char) => ` ${char} `)
    .replace(/\s+/g, " ")
    .trim();

  const hyphenMixed = normalized.match(/^(\d+)-(\d+)\/(\d+)(?:\s+|$)/);
  if (hyphenMixed?.[1] && hyphenMixed[2] && hyphenMixed[3]) {
    const denom = Number(hyphenMixed[3]);
    return {
      min:
        denom === 0
          ? Number(hyphenMixed[1])
          : Number(hyphenMixed[1]) + Number(hyphenMixed[2]) / denom,
      max: null,
      rest: normalized.slice(hyphenMixed[0].length).trim(),
    };
  }

  const range = normalized.match(
    /^(\d+\s+\d+\/\d+|\d+\/\d+|\d+(?:\.\d+)?|[¼½¾⅓⅔⅛⅜⅝⅞])\s*(?:-|\u2013|to)\s*(\d+\s+\d+\/\d+|\d+\/\d+|\d+(?:\.\d+)?|[¼½¾⅓⅔⅛⅜⅝⅞])(?:\s+|$)/i
  );
  if (range?.[1] && range[2]) {
    return {
      min: parseNumberToken(range[1].trim()),
      max: parseNumberToken(range[2].trim()),
      rest: normalized.slice(range[0].length).trim(),
    };
  }

  const andMixed = normalized.match(/^(\d+)\s+and\s+(\d+\/\d+|[¼½¾⅓⅔⅛⅜⅝⅞])(?:\s+|$)/i);
  if (andMixed?.[1] && andMixed[2]) {
    const whole = Number(andMixed[1]);
    const frac = parseNumberToken(andMixed[2]);
    return {
      min: frac == null ? whole : whole + frac,
      max: null,
      rest: normalized.slice(andMixed[0].length).trim(),
    };
  }

  const mixed = normalized.match(/^(\d+)\s+(\d+\/\d+|[¼½¾⅓⅔⅛⅜⅝⅞])(?:\s+|$)/);
  if (mixed?.[1] && mixed[2]) {
    const whole = Number(mixed[1]);
    const frac = parseNumberToken(mixed[2]);
    return {
      min: frac == null ? whole : whole + frac,
      max: null,
      rest: normalized.slice(mixed[0].length).trim(),
    };
  }

  const glued = normalized.match(/^(\d+\/\d+|\d+(?:\.\d+)?|[¼½¾⅓⅔⅛⅜⅝⅞])(?=[a-z])/i);
  if (glued?.[1]) {
    return {
      min: parseNumberToken(glued[1]),
      max: null,
      rest: normalized.slice(glued[1].length).trim(),
    };
  }

  const single = normalized.match(/^(\d+\/\d+|\d+(?:\.\d+)?|[¼½¾⅓⅔⅛⅜⅝⅞])(?:\s+|$)/);
  if (single?.[1]) {
    return {
      min: parseNumberToken(single[1]),
      max: null,
      rest: normalized.slice(single[0].length).trim(),
    };
  }

  return { min: null, max: null, rest: normalized };
}

function consumeUnit(text: string): { unit: string | null; rest: string } {
  const lower = text.toLowerCase();
  for (const alias of UNIT_ALIASES) {
    if (
      lower === alias.match ||
      lower.startsWith(`${alias.match} `) ||
      lower.startsWith(`${alias.match}.`)
    ) {
      return {
        unit: alias.unit,
        rest: text
          .slice(alias.match.length)
          .replace(/^\.\s*/, "")
          .trim(),
      };
    }
  }

  for (const alias of ["tbsp", "tsp", "cup", "oz", "lb"] as const) {
    if (!lower.startsWith(alias)) continue;
    const next = lower[alias.length];
    if (!next || !/[a-z]/.test(next)) continue;
    if (alias === "cup" && lower.startsWith("cups") && !/[a-z]/.test(lower[4] ?? "")) continue;
    return { unit: alias, rest: text.slice(alias.length).trim() };
  }

  return { unit: null, rest: text };
}

function cleanItemName(rest: string): string {
  let name = rest
    .replace(/^of\s+/i, "")
    .replace(/^,\s*/, "")
    .replace(/\s*\([^)]*\)\s*$/g, "")
    .replace(/\s+to taste$/i, "")
    .trim();

  const comma = name.lastIndexOf(",");
  if (comma > 0) {
    const tail = name.slice(comma + 1).trim();
    if (PREP_NOTES.test(tail)) {
      name = name.slice(0, comma).trim();
    }
  }

  return name;
}

export function parseIngredientLine(rawText: string): ParsedIngredientLine {
  const trimmed = rawText.trim();
  const quantity = consumeLeadingQuantity(trimmed);
  const afterQty = quantity.rest.replace(/^\([^)]*\)\s*/, "");
  const unit = quantity.min == null ? { unit: null, rest: afterQty } : consumeUnit(afterQty);

  return {
    rawText: trimmed,
    quantityMin: quantity.min,
    quantityMax: quantity.max,
    unit: unit.unit,
    name: cleanItemName(unit.rest),
  };
}

/** Lowercase merge key so "Olive Oil" and "olive oil" collapse together. */
export function normalizeIngredientName(name: string): string {
  return name
    .toLowerCase()
    .replace(/-/g, " ")
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Fill a stored recipe line that only has rawText / quantity / unit with an
 * item-level name (and any missing qty/unit) so existing recipes backfill on read.
 */
export function backfillParsedIngredient(input: BackfillableIngredient): BackfilledIngredient {
  const parsed = parseIngredientLine(input.rawText);
  const storedName = input.name?.trim();
  const name = storedName && storedName !== input.rawText.trim() ? storedName : parsed.name;
  return {
    name,
    quantityMin: input.quantityMin ?? parsed.quantityMin,
    quantityMax: input.quantityMax ?? parsed.quantityMax,
    unit: input.unit ?? parsed.unit,
  };
}
