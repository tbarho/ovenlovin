import { presentRecipeImages, type RecipeDetails } from "@ovenlovin/core";
import { resolveOrigin } from "@/lib/origin";

export function requestApiOrigin(request: { url: string; headers: Headers }): string {
  return resolveOrigin(request.headers) || new URL(request.url).origin;
}

export function presentListedRecipe<T extends { id: string; images?: string[] | null }>(
  recipe: T,
  origin: string
): T {
  return presentRecipeImages(recipe, { origin });
}

export function presentRecipeDetailsForApi(recipe: RecipeDetails, origin: string): RecipeDetails {
  return presentRecipeImages(recipe, { origin });
}
