import { clampServings, DEFAULT_RECIPE_SERVINGS } from "./servings";

export const DEFAULT_SERVINGS_MODES = ["family", "fixed", "recipe"] as const;

type DefaultServingsMode = (typeof DEFAULT_SERVINGS_MODES)[number];

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
  if (input.mode === "family") return clampServings(Math.max(yieldServings, cookFor));
  return cookFor;
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
}): {
  storedServings: number;
  displayServings: number;
  scaledNote: string | null;
} {
  const storedServings = recipeYieldServings(input.recipeServings);
  const displayServings = defaultDisplayedServings({
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
