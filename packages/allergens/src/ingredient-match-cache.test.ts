import { beforeEach, describe, expect, it } from "vitest";
import {
  buildIngredientMap,
  clearIngredientMatchCache,
  evictIngredientMatches,
  ingredientAllergenMappings,
  ingredientMatchCacheStats,
  ingredientMatchRefs,
  matchIngredient,
  missingIngredientMatches,
  primeIngredientMatches,
} from "./ingredient-mapping";
import { registerNegationCompounds } from "./phrase-match";

const LINES = [
  "2 tbsp olive oil",
  "1/4 cup toasted pine nuts",
  "peanut-free chocolate chips",
  "1 can coconut milk",
  "1 can water chestnuts",
  "2 eggs plus 1 egg yolk",
  "almond extract-free vanilla",
  "1/3 cup basil pesto",
  "2 cups shredded cheddar",
];

const codes = (line: string, map?: ReturnType<typeof buildIngredientMap>) =>
  matchIngredient(line, map).map((mapping) => `${mapping.allergenCode}:${mapping.relation}`);

describe("matchIngredient cache", () => {
  beforeEach(() => clearIngredientMatchCache());

  it("returns the same results as an uncached match, on miss and on hit", () => {
    const uncachedMap = buildIngredientMap();
    for (const line of LINES) {
      const expected = codes(line, uncachedMap);
      expect(codes(line)).toEqual(expected);
      expect(codes(line)).toEqual(expected);
    }
    const stats = ingredientMatchCacheStats();
    expect(stats.size).toBe(LINES.length);
    expect(stats.hits).toBeGreaterThanOrEqual(LINES.length);
  });

  it("cannot be poisoned by a caller mutating its result", () => {
    const first = matchIngredient("1/4 cup toasted pine nuts");
    expect(first.length).toBeGreaterThan(0);
    first.length = 0;
    expect(matchIngredient("1/4 cup toasted pine nuts").length).toBeGreaterThan(0);
  });

  it("evicts only the given lines", () => {
    matchIngredient(LINES[0]!);
    matchIngredient(LINES[1]!);
    evictIngredientMatches([LINES[0]!]);
    expect(ingredientMatchCacheStats().size).toBe(1);
  });

  it("skips very long lines", () => {
    matchIngredient(`peanuts ${"x".repeat(600)}`);
    expect(ingredientMatchCacheStats().size).toBe(0);
  });

  it("drops cached results when a new negation compound is registered", () => {
    matchIngredient(LINES[0]!);
    expect(ingredientMatchCacheStats().size).toBe(1);
    registerNegationCompounds(["cache test compound"]);
    matchIngredient(LINES[1]!);
    expect(ingredientMatchCacheStats().size).toBe(1);
  });

  it("gives every catalog mapping a unique ref, so stored refs resolve to one mapping", () => {
    const refs = ingredientAllergenMappings.map(
      (mapping) => `${mapping.allergenCode}\0${mapping.relation}\0${mapping.name}`
    );
    expect(new Set(refs).size).toBe(refs.length);
  });

  it("round-trips refs to the same result, including lines with no allergen", () => {
    const stored = Object.fromEntries(
      [...LINES, "1 cup water"].map((line) => [line, ingredientMatchRefs(line)])
    );
    const expected = Object.keys(stored).map((line) => codes(line));
    clearIngredientMatchCache();
    expect(missingIngredientMatches(Object.keys(stored))).toHaveLength(LINES.length + 1);
    primeIngredientMatches(stored);
    expect(missingIngredientMatches(Object.keys(stored))).toEqual([]);
    expect(Object.keys(stored).map((line) => codes(line))).toEqual(expected);
  });

  it("skips stored lines that do not fully resolve instead of trusting them", () => {
    const line = "1/4 cup toasted pine nuts";
    const [good] = ingredientMatchRefs(line);
    clearIngredientMatchCache();
    primeIngredientMatches({ [line]: [good, "not-a-ref"], "2 eggs": "nope" });
    primeIngredientMatches(null);
    expect(missingIngredientMatches([line, "2 eggs"])).toEqual([line, "2 eggs"]);
  });

  it("does not report uncacheable long lines as missing", () => {
    expect(missingIngredientMatches(["x".repeat(600)])).toEqual([]);
  });
});
