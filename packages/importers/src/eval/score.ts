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

function servingsMatched(got: number | undefined, expected: ExpectedRecipe): boolean | null {
  if (expected.servings == null) return null;
  const allowed = Array.isArray(expected.servings) ? expected.servings : [expected.servings];
  return got != null && allowed.includes(got);
}

/**
 * Whole-line match: equal after normalize, or the shorter line's tokens
 * (2+) are all in the longer. Single-token keys never match a longer line
 * ("egg" / "egg noodles", "sugar" / "brown sugar").
 */
export function ingredientMatched(got: string, expected: string): boolean {
  const a = tokens(got);
  const b = tokens(expected);
  if (a.length === 0 || b.length === 0) return false;
  if (a.join(" ") === b.join(" ")) return true;
  const [small, big] = a.length <= b.length ? [a, b] : [b, a];
  if (small.length < 2) return false;
  const have = new Set(big);
  return small.every((token) => have.has(token));
}

function assignIngredientHits(got: string[], want: string[]): number {
  const pairs: Array<{ g: number; w: number; score: number }> = [];
  for (let g = 0; g < got.length; g++) {
    for (let w = 0; w < want.length; w++) {
      const left = got[g];
      const right = want[w];
      if (left == null || right == null || !ingredientMatched(left, right)) continue;
      const gt = tokens(left).length;
      const wt = tokens(right).length;
      pairs.push({ g, w, score: Math.min(gt, wt) / Math.max(gt, wt) });
    }
  }
  pairs.sort((left, right) => right.score - left.score);
  const usedGot = new Set<number>();
  const usedWant = new Set<number>();
  let hits = 0;
  for (const pair of pairs) {
    if (usedGot.has(pair.g) || usedWant.has(pair.w)) continue;
    usedGot.add(pair.g);
    usedWant.add(pair.w);
    hits += 1;
  }
  return hits;
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

  const expectedSteps = expected.stepCount;
  const observedSteps = observed.steps.length;
  const countRecall =
    expectedSteps <= 0 ? 1 : Math.min(observedSteps, expectedSteps) / expectedSteps;
  const countPrecision =
    observedSteps === 0
      ? expectedSteps === 0
        ? 1
        : 0
      : Math.min(observedSteps, expectedSteps) / observedSteps;
  const keyHits = expected.stepMustInclude.filter((key) =>
    observed.steps.some((step) => normalizeText(step).includes(normalizeText(key)))
  ).length;
  const keyScore =
    expected.stepMustInclude.length === 0 ? 1 : keyHits / expected.stepMustInclude.length;
  const stepCompleteness = (countRecall + countPrecision + keyScore) / 3;

  const parts = [title, ingredientRecall, ingredientPrecision, stepCompleteness];
  if (servings != null) parts.push(servings);
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
