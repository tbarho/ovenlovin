/**
 * Positive preferences ("Loves") never filter recipes.
 * They boost ranking and surface a small “{Name} loves this” tag.
 */

import type { Preference } from "@ovenlovin/core";
import { displayNameForTarget, findCatalogEntry, matchPhrasesForTarget } from "./catalog";
import { phraseMatchesAny, phraseMatchesLine } from "./phrase-match";

export const LOVE_PREFERENCE_TYPE = "love";

export type LovePreference = Pick<Preference, "id" | "personId" | "value" | "weight"> & {
  type?: string;
};

export type RecipeLoveFields = {
  title: string;
  description?: string | null;
  cuisine?: string | null;
  course?: string | null;
  methodTags?: string[] | null;
  ingredients?: Array<{ rawText?: string | null; name?: string | null }>;
};

export type PersonLove = {
  personId: string;
  personName: string;
  preference: LovePreference;
};

export type LoveHit = {
  personId: string;
  personName: string;
  value: string;
  label: string;
  tag: string;
};

export function isLovePreference(preference: { type: string }): boolean {
  return preference.type === LOVE_PREFERENCE_TYPE;
}

export function loveLabel(value: string): string {
  return (
    findCatalogEntry(value, "style")?.name ??
    findCatalogEntry(value, "cuisine")?.name ??
    findCatalogEntry(value, "ingredient")?.name ??
    displayNameForTarget(value)
  );
}

export function loveTag(personName: string): string {
  return `${personName} loves this`;
}

export function recipeHaystack(recipe: RecipeLoveFields): string[] {
  return [
    recipe.title,
    recipe.description ?? "",
    recipe.cuisine ?? "",
    recipe.course ?? "",
    ...(recipe.methodTags ?? []),
    ...(recipe.ingredients ?? []).map((item) => item.rawText || item.name || ""),
  ].filter((line) => line.trim().length > 0);
}

export function recipeHasIngredients(recipe: RecipeLoveFields): boolean {
  return (recipe.ingredients?.length ?? 0) > 0;
}

export function recipeMatchesLove(recipe: RecipeLoveFields, value: string): boolean {
  if (!recipeHasIngredients(recipe)) return false;
  const phrases = matchPhrasesForTarget(value);
  const lines = recipeHaystack(recipe);
  return phrases.some(
    (phrase) => phraseMatchesAny(phrase, lines) || phraseMatchesLine(phrase, recipe.title)
  );
}

export function lovesForRecipe(recipe: RecipeLoveFields, people: PersonLove[]): LoveHit[] {
  if (!recipeHasIngredients(recipe)) return [];
  const hits: LoveHit[] = [];
  const seen = new Set<string>();
  for (const person of people) {
    if (!recipeMatchesLove(recipe, person.preference.value)) continue;
    const key = `${person.personId}:${person.preference.value}`;
    if (seen.has(key)) continue;
    seen.add(key);
    hits.push({
      personId: person.personId,
      personName: person.personName,
      value: person.preference.value,
      label: loveLabel(person.preference.value),
      tag: loveTag(person.personName),
    });
  }
  return hits;
}

export function loveScore(recipe: RecipeLoveFields, people: PersonLove[]): number {
  if (!recipeHasIngredients(recipe)) return 0;
  let score = 0;
  for (const person of people) {
    if (recipeMatchesLove(recipe, person.preference.value)) {
      score += person.preference.weight ?? 1;
    }
  }
  return score;
}

export function rankRecipesByLoves<T extends RecipeLoveFields>(
  recipes: T[],
  people: PersonLove[]
): T[] {
  if (people.length === 0) return recipes;
  return [...recipes].sort((a, b) => {
    const delta = loveScore(b, people) - loveScore(a, people);
    if (delta !== 0) return delta;
    return a.title.localeCompare(b.title);
  });
}
