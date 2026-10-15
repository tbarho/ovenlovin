import type { Recipe } from "@ovenlovin/core";

export function filterRecipesByQuery(recipes: Recipe[], query: string): Recipe[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return recipes;
  return recipes.filter((recipe) => recipe.title.toLowerCase().includes(needle));
}
