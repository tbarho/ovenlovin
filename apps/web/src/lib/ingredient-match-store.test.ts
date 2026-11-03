import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearIngredientMatchCache,
  ingredientMatchRefs,
  missingIngredientMatches,
} from "@ovenlovin/allergens";
import { emitRecipeIngredientsRemoved } from "@ovenlovin/core/recipe-events";

const cache = vi.hoisted(() => ({
  get: vi.fn(),
  set: vi.fn(),
  expireTag: vi.fn(),
}));
const getCache = vi.hoisted(() => vi.fn(() => cache));

vi.mock("@vercel/functions", () => ({
  getCache,
  waitUntil: (work: Promise<unknown>) => work,
}));

import {
  registerIngredientMatchEviction,
  sharedMatchCache,
  warmIngredientMatches,
} from "./ingredient-match-store";

const LINE = "1/4 cup toasted pine nuts";
const RECIPE = { recipeId: "recipe-1", lines: [LINE] };

function deployed() {
  vi.stubEnv("VERCEL_ENV", "production");
  vi.stubEnv("VERCEL_DEPLOYMENT_ID", "dpl_1");
}

describe("ingredient match store", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearIngredientMatchCache();
    cache.get.mockResolvedValue(null);
    cache.set.mockResolvedValue(undefined);
    cache.expireTag.mockResolvedValue(undefined);
  });
  afterEach(() => vi.unstubAllEnvs());

  it("stays memory-only unless deployed on Vercel with a deployment id", () => {
    expect(sharedMatchCache({})).toBeNull();
    expect(sharedMatchCache({ VERCEL: "1", VERCEL_ENV: "development" })).toBeNull();
    expect(sharedMatchCache({ VERCEL_ENV: "production" })).toBeNull();
    expect(getCache).not.toHaveBeenCalled();
    expect(sharedMatchCache({ VERCEL_ENV: "preview", VERCEL_DEPLOYMENT_ID: "dpl_1" })).toBe(cache);
    expect(getCache).toHaveBeenCalledWith({ namespace: "allergen-matches-dpl_1" });
  });

  it("does nothing locally", async () => {
    await warmIngredientMatches([RECIPE]);
    expect(cache.get).not.toHaveBeenCalled();
    expect(missingIngredientMatches([LINE])).toEqual([LINE]);
  });

  it("fills memory from a shared hit without writing back", async () => {
    deployed();
    cache.get.mockResolvedValue({ [LINE]: ingredientMatchRefs(LINE) });
    clearIngredientMatchCache();
    await warmIngredientMatches([RECIPE]);
    expect(missingIngredientMatches([LINE])).toEqual([]);
    expect(cache.set).not.toHaveBeenCalled();
  });

  it("computes and writes back on a miss, tagged by recipe", async () => {
    deployed();
    await warmIngredientMatches([RECIPE]);
    expect(cache.set).toHaveBeenCalledWith(
      expect.any(String),
      { [LINE]: ingredientMatchRefs(LINE) },
      expect.objectContaining({ tags: ["recipe:recipe-1"] })
    );
  });

  it("skips the network when memory already has every line", async () => {
    deployed();
    ingredientMatchRefs(LINE);
    await warmIngredientMatches([RECIPE]);
    expect(cache.get).not.toHaveBeenCalled();
  });

  it("treats a failed or slow read as a miss", async () => {
    deployed();
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    cache.get.mockRejectedValueOnce(new Error("down"));
    await expect(warmIngredientMatches([RECIPE])).resolves.toBeUndefined();
    clearIngredientMatchCache();
    cache.get.mockReturnValueOnce(new Promise(() => {}));
    await expect(warmIngredientMatches([RECIPE])).resolves.toBeUndefined();
    expect(cache.set).toHaveBeenCalledTimes(2);
    error.mockRestore();
  });

  it("evicts memory and the recipe's shared entries when lines leave a recipe", () => {
    deployed();
    registerIngredientMatchEviction();
    ingredientMatchRefs(LINE);
    emitRecipeIngredientsRemoved("recipe-1", [LINE]);
    expect(missingIngredientMatches([LINE])).toEqual([LINE]);
    expect(cache.expireTag).toHaveBeenCalledWith("recipe:recipe-1");
  });
});
