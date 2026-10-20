import type { DefaultServingsMode } from "../schemas/households";
import type { RecipeDetails } from "../schemas/recipes";
import { clampServings, DEFAULT_RECIPE_SERVINGS, scaleIngredientDisplay } from "./servings";

export const DEFAULT_SERVINGS_MODES = ["family", "fixed", "recipe"] as const;

export type HouseholdServingsSetting = {
  mode: DefaultServingsMode;
  servings: number | null;
};

export function parseDefaultServingsMode(value: unknown): DefaultServingsMode {
  if (value === "fixed" || value === "recipe" || value === "family") return value;
  return "family";
}

export function recipeYieldServings(recipeServings?: number | null): number {
  return recipeServings && recipeServings > 0 ? recipeServings : DEFAULT_RECIPE_SERVINGS;
}

export function normalizeHouseholdServingsSetting(input: {
  mode?: unknown;
  servings?: number | null;
}): HouseholdServingsSetting {
  const mode = parseDefaultServingsMode(input.mode);
  if (mode !== "fixed") return { mode, servings: null };
  const servings =
    input.servings && input.servings > 0 ? clampServings(input.servings) : DEFAULT_RECIPE_SERVINGS;
  return { mode, servings };
}

/** Week-level cook-for used by the meal plan selector and new plan entries. */
export function weekDefaultServings(input: {
  familySize: number;
  mode: DefaultServingsMode;
  fixedServings?: number | null;
}): number {
  if (input.mode === "recipe") return DEFAULT_RECIPE_SERVINGS;
  if (input.mode === "fixed") {
    return clampServings(
      input.fixedServings && input.fixedServings > 0 ? input.fixedServings : DEFAULT_RECIPE_SERVINGS
    );
  }
  return clampServings(input.familySize > 0 ? input.familySize : DEFAULT_RECIPE_SERVINGS);
}

/**
 * Displayed servings for a recipe: family mode never scales below the card's
 * yield; a 4-serving recipe for 8 people opens at 8, a 10-serving recipe stays 10.
 */
export function defaultDisplayedServings(input: {
  recipeServings?: number | null;
  familySize: number;
  mode: DefaultServingsMode;
  fixedServings?: number | null;
}): number {
  const yieldServings = recipeYieldServings(input.recipeServings);
  if (input.mode === "recipe") return clampServings(yieldServings);
  if (input.mode === "fixed") {
    return weekDefaultServings(input);
  }
  return clampServings(Math.max(yieldServings, input.familySize > 0 ? input.familySize : 0));
}

/** Stored meal-plan entry servings when adding a recipe at the current cook-for. */
export function planEntryServings(input: {
  recipeServings?: number | null;
  cookFor: number;
  mode: DefaultServingsMode;
}): number {
  const yieldServings = recipeYieldServings(input.recipeServings);
  const cookFor = clampServings(input.cookFor);
  if (input.mode === "recipe") return clampServings(yieldServings);
  return cookFor;
}

/**
 * Servings used for a plan card and shopping line.
 * Entry servings win; otherwise a stored scaleFactor other than 1; otherwise
 * recipe yield in recipe mode; otherwise household cook-for.
 */
export function effectivePlanServings(input: {
  entryServings?: number | null;
  defaultCookFor: number;
  mode?: DefaultServingsMode;
  recipeServings?: number | null;
  scaleFactor?: number | null;
}): number {
  if (input.entryServings && input.entryServings > 0) return clampServings(input.entryServings);
  const yieldServings = recipeYieldServings(input.recipeServings);
  // shortcut: stored 1 is identity, treat as unset until entries omit it
  if (input.scaleFactor && input.scaleFactor > 0 && Math.abs(input.scaleFactor - 1) > 1e-9) {
    return clampServings(input.scaleFactor * yieldServings);
  }
  if (input.mode === "recipe") return clampServings(yieldServings);
  return clampServings(input.defaultCookFor);
}

/**
 * Shared kitchen copy for recipe pages and plan cards.
 * When the card yield differs from cook-for, name both; otherwise "{n} servings".
 */
export function cookForServingsLabel(input: {
  cookFor: number;
  recipeServings?: number | null;
}): string {
  const cookFor = clampServings(input.cookFor);
  const recipeMakes =
    input.recipeServings && input.recipeServings > 0 ? input.recipeServings : null;
  if (recipeMakes != null && recipeMakes !== cookFor) {
    return `Recipe makes ${recipeMakes} · cooking for ${cookFor}`;
  }
  return `${cookFor} ${cookFor === 1 ? "serving" : "servings"}`;
}

/** Optional `?servings=` override for REST/MCP recipe display. */
export function parseServingsQuery(value: string | number | null | undefined): number | null {
  if (value == null || value === "") return null;
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return clampServings(parsed);
}

export function scaledServingsNote(input: {
  displayed: number;
  recipeServings: number;
  mode: DefaultServingsMode;
  familySize: number;
  fixedServings?: number | null;
}): string | null {
  if (input.displayed === input.recipeServings) return null;
  if (input.mode === "family") {
    const familyDefault = defaultDisplayedServings({
      recipeServings: input.recipeServings,
      familySize: input.familySize,
      mode: "family",
    });
    if (input.displayed === familyDefault) {
      return `Scaled to ${input.displayed} for your family`;
    }
  }
  if (input.mode === "fixed") {
    const kitchenDefault = defaultDisplayedServings({
      recipeServings: input.recipeServings,
      familySize: input.familySize,
      mode: "fixed",
      fixedServings: input.fixedServings,
    });
    if (input.displayed === kitchenDefault) {
      return `Scaled to ${input.displayed} from the kitchen default`;
    }
  }
  return `Scaled from ${input.recipeServings} stored servings`;
}

export function recipeServingsPresentation(input: {
  recipeServings?: number | null;
  familySize: number;
  mode: DefaultServingsMode;
  fixedServings?: number | null;
  servingsOverride?: number | null;
}): {
  storedServings: number;
  displayServings: number;
  scaledNote: string | null;
} {
  const storedServings = recipeYieldServings(input.recipeServings);
  const displayServings =
    input.servingsOverride && input.servingsOverride > 0
      ? clampServings(input.servingsOverride)
      : defaultDisplayedServings({
          ...input,
          recipeServings: storedServings,
        });
  return {
    storedServings,
    displayServings,
    scaledNote: scaledServingsNote({
      displayed: displayServings,
      recipeServings: storedServings,
      mode: input.mode,
      familySize: input.familySize,
      fixedServings: input.fixedServings,
    }),
  };
}

/** Apply kitchen Default servings or a `?servings=` override to a recipe payload. */
export function presentDisplayedRecipe(
  recipe: RecipeDetails,
  settings: {
    familySize: number;
    mode: DefaultServingsMode;
    fixedServings?: number | null;
    servingsOverride?: number | null;
  }
): RecipeDetails {
  const presentation = recipeServingsPresentation({
    recipeServings: recipe.servings,
    familySize: settings.familySize,
    mode: settings.mode,
    fixedServings: settings.fixedServings,
    servingsOverride: settings.servingsOverride,
  });
  return withDisplayedServings(recipe, presentation.displayServings, presentation.scaledNote);
}

/** Scale ingredient displayText to kitchen Default servings or a `?servings=` override. */
export function withDisplayedServings(
  recipe: RecipeDetails,
  displayServings: number,
  scaledNote: string | null
): RecipeDetails {
  const from = recipeYieldServings(recipe.servings);
  return {
    ...recipe,
    displayServings,
    scaledNote,
    ingredients: recipe.ingredients.map((ingredient) => ({
      ...ingredient,
      displayText: scaleIngredientDisplay(ingredient, from, displayServings),
    })),
  };
}
