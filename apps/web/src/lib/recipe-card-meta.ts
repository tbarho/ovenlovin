export function recipeCardMeta(recipe: {
  servings?: number | null;
  prepTimeMinutes?: number | null;
  cookTimeMinutes?: number | null;
}): string {
  return (
    [
      recipe.servings ? `${recipe.servings} servings` : null,
      recipe.prepTimeMinutes != null ? `${recipe.prepTimeMinutes} min prep` : null,
      recipe.cookTimeMinutes != null ? `${recipe.cookTimeMinutes} min cook` : null,
    ]
      .filter(Boolean)
      .join(" · ") || "Add details"
  );
}
