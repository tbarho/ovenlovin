import {
  LOVE_PREFERENCE_TYPE,
  lovesForRecipe,
  rankRecipesByLoves,
  type LoveHit,
  type PersonLove,
  type RecipeLoveFields,
} from "@ovenlovin/allergens";
import type { Person, Preference, Recipe } from "@ovenlovin/core";

export function householdLovePeople(people: Person[], preferences: Preference[]): PersonLove[] {
  return preferences
    .filter((item) => item.type === LOVE_PREFERENCE_TYPE)
    .map((preference) => {
      const person = people.find((item) => item.id === preference.personId);
      return {
        personId: preference.personId,
        personName: person?.displayName ?? "Someone",
        preference,
      };
    });
}

export function loveHitsForRecipe(recipe: RecipeLoveFields, people: PersonLove[]): LoveHit[] {
  return lovesForRecipe(recipe, people);
}

export function qualifyLoveHits(
  hits: LoveHit[],
  conflictPersonIds: Iterable<string>
): LoveHit[] {
  const conflicts = new Set(conflictPersonIds);
  return hits.map((hit) =>
    conflicts.has(hit.personId)
      ? { ...hit, tag: `${hit.tag}, but check first` }
      : hit
  );
}

export function sortRecipesByLoves<T extends Recipe>(recipes: T[], people: PersonLove[]): T[] {
  return rankRecipesByLoves(recipes, people);
}
