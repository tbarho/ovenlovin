import type { Recipe } from "@ovenlovin/core";

export function pickerBookNote(inThisBook: boolean, otherBooks: string[]): string | null {
  if (inThisBook && otherBooks.length === 0) return "Already in this book";
  if (inThisBook) return `Already in this book · also ${otherBooks.join(", ")}`;
  if (otherBooks.length === 0) return null;
  return `In ${otherBooks.join(", ")}`;
}

export function filterRecipesByQuery(recipes: Recipe[], query: string): Recipe[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return recipes;
  return recipes.filter((recipe) => recipe.title.toLowerCase().includes(needle));
}
