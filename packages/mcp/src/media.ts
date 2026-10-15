import { appOriginFromEnv, publicRecipeImages } from "@ovenlovin/core";

export function mcpOrigin(
  env: Record<string, string | undefined> = process.env
): string | undefined {
  return appOriginFromEnv(env);
}

export function mcpRecipeImages(
  recipeId: string,
  images: string[] | null | undefined,
  env: Record<string, string | undefined> = process.env
): string[] {
  return publicRecipeImages(recipeId, images, { origin: mcpOrigin(env) });
}
