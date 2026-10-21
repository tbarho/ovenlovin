/** Overall import score must meet this to pass an eve gate. */
export const IMPORT_EVAL_SCORE_GATE = 0.95;

export type ExpectedIngredient = {
  line: string;
  food: string;
  optional?: boolean;
};

export type ExpectedRecipe = {
  title: string;
  titleAliases?: string[];
  /** Canonical servings. Omitted from the overall score; see `acceptServings`. */
  servings?: number | null;
  /** Allowed servings. `[]` means the key has none and servings are not scored. */
  acceptServings?: number[];
  ingredients: ExpectedIngredient[];
  stepCount: number;
  acceptStepCounts?: number[];
};

export type ObservedRecipe = {
  title?: string;
  servings?: number;
  ingredients: string[];
  steps: string[];
};

export type CaseScores = {
  title: number;
  servings: number | null;
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

function tokens(value: string): string[] {
  return normalizeText(value).split(" ").filter(Boolean);
}

function tokenSet(value: string): Set<string> {
  return new Set(tokens(value));
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

function allowedServings(expected: ExpectedRecipe): number[] | null {
  if (expected.acceptServings) {
    return expected.acceptServings.length === 0 ? null : expected.acceptServings;
  }
  if (expected.servings == null) return null;
  return [expected.servings];
}

function servingsMatched(got: number | undefined, expected: ExpectedRecipe): boolean | null {
  const allowed = allowedServings(expected);
  if (allowed == null) return null;
  return got != null && allowed.includes(got);
}

function allowedStepCounts(expected: ExpectedRecipe): number[] {
  return expected.acceptStepCounts?.length ? expected.acceptStepCounts : [expected.stepCount];
}

/**
 * shortcut: only these compounds count as a different modified food;
 * add one when a live case or negative test needs it.
 */
const MODIFIED_FOODS = [
  "brown sugar",
  "egg noodles",
  "chicken broth",
  "red pepper flakes",
  "red bell pepper",
  "bell pepper",
];

function hasTokensInOrder(lineToks: string[], need: string[]): boolean {
  let i = 0;
  for (const token of need) {
    let found = -1;
    for (let j = i; j < lineToks.length; j++) {
      const got = lineToks[j];
      if (got != null && tokensMatch(got, token)) {
        found = j;
        break;
      }
    }
    if (found < 0) return false;
    i = found + 1;
  }
  return true;
}

/** Food tokens appear as whole words in the line (gaps allowed for "granulated white sugar"). */
export function ingredientMatched(line: string, food: string): boolean {
  const lineToks = tokens(line);
  const foodToks = tokens(food);
  if (lineToks.length === 0 || foodToks.length === 0) return false;
  if (!hasTokensInOrder(lineToks, foodToks)) return false;
  const foodNorm = normalizeText(food);
  return !MODIFIED_FOODS.some((compound) => {
    const compoundToks = tokens(compound);
    if (compoundToks.length <= foodToks.length) return false;
    if (!normalizeText(compound).includes(foodNorm)) return false;
    return hasTokensInOrder(lineToks, compoundToks);
  });
}

function assignIngredientHits(got: string[], want: ExpectedIngredient[]): number {
  const order = want
    .map((item, w) => ({ w, food: item.food, len: tokens(item.food).length }))
    .sort((left, right) => right.len - left.len);
  const usedGot = new Set<number>();
  let hits = 0;
  for (const key of order) {
    for (let g = 0; g < got.length; g++) {
      if (usedGot.has(g)) continue;
      const line = got[g];
      if (line == null || !ingredientMatched(line, key.food)) continue;
      usedGot.add(g);
      hits += 1;
      break;
    }
  }
  return hits;
}

function stepCompletenessOf(observedSteps: number, expected: ExpectedRecipe): number {
  const allowed = allowedStepCounts(expected);
  if (allowed.includes(observedSteps)) return 1;
  const nearest = allowed.reduce((best, n) =>
    Math.abs(n - observedSteps) < Math.abs(best - observedSteps) ? n : best
  );
  const countRecall = nearest <= 0 ? 1 : Math.min(observedSteps, nearest) / nearest;
  const countPrecision =
    observedSteps === 0
      ? nearest === 0
        ? 1
        : 0
      : Math.min(observedSteps, nearest) / observedSteps;
  return (countRecall + countPrecision) / 2;
}

export function scoreRecipe(observed: ObservedRecipe, expected: ExpectedRecipe): CaseScores {
  const title = titleMatched(observed.title, expected) ? 1 : 0;
  const servingsHit = servingsMatched(observed.servings, expected);
  const servings = servingsHit == null ? null : servingsHit ? 1 : 0;

  const hits = assignIngredientHits(observed.ingredients, expected.ingredients);
  const ingredientRecall =
    expected.ingredients.length === 0 ? 1 : hits / expected.ingredients.length;
  const ingredientPrecision =
    observed.ingredients.length === 0 ? 0 : hits / observed.ingredients.length;
  const stepCompleteness = stepCompletenessOf(observed.steps.length, expected);

  // min: one dropped/invented ingredient must fail 0.95; mean would not. Servings stay out (correctness ignores them).
  const score = Math.min(title, ingredientRecall, ingredientPrecision, stepCompleteness);

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
