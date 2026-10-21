/** Overall import score must meet this to pass an eve gate. */
export const IMPORT_EVAL_SCORE_GATE = 0.95;

export type ExpectedRecipe = {
  title: string;
  titleAliases?: string[];
  /** `null` means servings are omitted from the overall score. An array accepts any of the values. */
  servings?: number | number[] | null;
  ingredients: string[];
  stepCount: number;
  stepMustInclude: string[];
};

export type ObservedRecipe = {
  title?: string;
  servings?: number;
  ingredients: string[];
  steps: string[];
};

export type CaseScores = {
  title: number;
  servings: number;
  ingredientRecall: number;
  ingredientPrecision: number;
  stepCompleteness: number;
  score: number;
};

export function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[½]/g, " 1/2 ")
    .replace(/[¼]/g, " 1/4 ")
    .replace(/[¾]/g, " 3/4 ")
    .replace(/[⅓]/g, " 1/3 ")
    .replace(/[⅔]/g, " 2/3 ")
    .replace(/[⅛]/g, " 1/8 ")
    .replace(/\([^)]*\$[^)]*\)/g, " ")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9/\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenSet(value: string): Set<string> {
  return new Set(
    normalizeText(value)
      .split(" ")
      .filter((token) => token.length > 1)
  );
}

function tokensMatch(a: string, b: string): boolean {
  return a === b || a === `${b}s` || b === `${a}s`;
}

function titleMatched(got: string | undefined, expected: ExpectedRecipe): boolean {
  const observed = normalizeText(got ?? "");
  if (!observed) return false;
  const candidates = [expected.title, ...(expected.titleAliases ?? [])].map(normalizeText);
  if (candidates.some((title) => observed === title)) return true;
  return candidates.some((title) => {
    const need = tokenSet(title);
    const have = tokenSet(observed);
    if (need.size === 0 || have.size < need.size) return false;
    return [...need].every((token) => [...have].some((gotToken) => tokensMatch(gotToken, token)));
  });
}

function servingsMatched(got: number | undefined, expected: ExpectedRecipe): boolean | null {
  if (expected.servings == null) return null;
  const allowed = Array.isArray(expected.servings) ? expected.servings : [expected.servings];
  return got != null && allowed.includes(got);
}

const FILLER = new Set([
  "a",
  "an",
  "and",
  "the",
  "of",
  "or",
  "to",
  "with",
  "for",
  "in",
  "into",
  "cup",
  "cups",
  "tbsp",
  "tsp",
  "teaspoon",
  "teaspoons",
  "tablespoon",
  "tablespoons",
  "oz",
  "ounce",
  "ounces",
  "lb",
  "pound",
  "pounds",
  "g",
  "kg",
  "ml",
  "can",
  "jar",
  "large",
  "small",
  "medium",
  "fresh",
  "dried",
  "chopped",
  "diced",
  "minced",
  "grated",
  "sliced",
  "peeled",
  "crushed",
  "cooked",
  "frozen",
  "canned",
  "softened",
  "melted",
  "packed",
  "unsalted",
  "salted",
  "optional",
  "all",
  "purpose",
  "extra",
  "virgin",
  "ripe",
  "old",
  "fashioned",
  "leaves",
  "cloves",
  "stick",
  "sticks",
]);

function isFillerToken(token: string): boolean {
  return FILLER.has(token) || /^\d/.test(token) || token.includes("/");
}

function lastContentToken(value: string): string | undefined {
  return normalizeText(value)
    .split(" ")
    .filter((token) => token.length > 1 && !isFillerToken(token))
    .at(-1);
}

function ingredientMatched(got: string, expected: string): boolean {
  const a = normalizeText(got);
  const b = normalizeText(expected);
  if (!a || !b) return false;
  if (a === b) return true;
  const have = tokenSet(got);
  const need = tokenSet(expected);
  if (need.size === 0) return false;
  if (![...need].every((token) => [...have].some((gotToken) => tokensMatch(gotToken, token)))) {
    return false;
  }
  const gotHead = lastContentToken(got);
  const needHead = lastContentToken(expected);
  return Boolean(gotHead && needHead && tokensMatch(gotHead, needHead));
}

export function scoreRecipe(observed: ObservedRecipe, expected: ExpectedRecipe): CaseScores {
  const title = titleMatched(observed.title, expected) ? 1 : 0;
  const servingsHit = servingsMatched(observed.servings, expected);
  const servings = servingsHit == null ? 0 : servingsHit ? 1 : 0;

  const expectedHits = expected.ingredients.filter((want) =>
    observed.ingredients.some((got) => ingredientMatched(got, want))
  ).length;
  const gotHits = observed.ingredients.filter((got) =>
    expected.ingredients.some((want) => ingredientMatched(got, want))
  ).length;
  const ingredientRecall =
    expected.ingredients.length === 0 ? 1 : expectedHits / expected.ingredients.length;
  const ingredientPrecision =
    observed.ingredients.length === 0 ? 0 : gotHits / observed.ingredients.length;

  const expectedSteps = expected.stepCount;
  const observedSteps = observed.steps.length;
  const countRecall = expectedSteps <= 0 ? 1 : Math.min(observedSteps, expectedSteps) / expectedSteps;
  const countPrecision =
    observedSteps === 0 ? (expectedSteps === 0 ? 1 : 0) : Math.min(observedSteps, expectedSteps) / observedSteps;
  const keyHits = expected.stepMustInclude.filter((key) =>
    observed.steps.some((step) => normalizeText(step).includes(normalizeText(key)))
  ).length;
  const keyScore =
    expected.stepMustInclude.length === 0 ? 1 : keyHits / expected.stepMustInclude.length;
  const stepCompleteness = (countRecall + countPrecision + keyScore) / 3;

  const parts = [title, ingredientRecall, ingredientPrecision, stepCompleteness];
  if (servingsHit != null) parts.push(servings);
  const score = mean(parts);

  return {
    title,
    servings,
    ingredientRecall,
    ingredientPrecision,
    stepCompleteness,
    score,
  };
}

export function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const even = sorted.length % 2 === 0;
  const a = sorted[mid];
  const b = even ? sorted[mid - 1] : a;
  if (a == null || b == null) return 0;
  return even ? (a + b) / 2 : a;
}

export function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}
