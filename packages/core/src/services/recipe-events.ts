/**
 * Recipe change hooks for code core cannot import (allergens depends on core).
 * Listeners sit on globalThis because Next gives every route bundle its own copy
 * of this module, and the listener is registered from instrumentation, not the route.
 */
// eslint-disable-next-line no-unused-vars -- call-signature parameter names
type IngredientLinesListener = (recipeId: string, ingredientLines: string[]) => void;

const store = globalThis as { __ovenlovinRecipeLineListeners?: Set<IngredientLinesListener> };
const removedListeners = (store.__ovenlovinRecipeLineListeners ??= new Set());

/** Runs `listener` with the raw lines that left a recipe (edited away or recipe deleted). */
export function onRecipeIngredientsRemoved(listener: IngredientLinesListener): () => void {
  removedListeners.add(listener);
  return () => removedListeners.delete(listener);
}

export function emitRecipeIngredientsRemoved(recipeId: string, ingredientLines: string[]): void {
  if (ingredientLines.length === 0) return;
  for (const listener of removedListeners) {
    try {
      listener(recipeId, ingredientLines);
    } catch (error) {
      // A listener is housekeeping (cache eviction); it must never fail the recipe write.
      // eslint-disable-next-line no-undef
      console.error("recipe ingredients listener failed", error);
    }
  }
}
