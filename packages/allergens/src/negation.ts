/**
 * Negated allergen wording. "dairy-free", "nut-free", and "no peanuts"
 * must not produce a finding for that allergen family.
 */

import { getAncestors } from "./taxonomy";
import { phraseMatchesLine } from "./phrase-match";

const FREE_CLAIM_HINTS: Record<string, string[]> = {
  peanut: ["peanut", "peanuts"],
  tree_nut: ["nut", "nuts", "tree nut", "tree nuts"],
  almond: ["almond", "nut", "nuts"],
  cashew: ["cashew", "nut", "nuts"],
  pecan: ["pecan", "nut", "nuts"],
  walnut: ["walnut", "nut", "nuts"],
  pistachio: ["pistachio", "nut", "nuts"],
  hazelnut: ["hazelnut", "nut", "nuts"],
  macadamia: ["macadamia", "nut", "nuts"],
  brazil_nut: ["brazil nut", "nut", "nuts"],
  pine_nut: ["pine nut", "pesto", "nut", "nuts"],
  chestnut: ["chestnut", "nut", "nuts"],
  coconut: ["coconut"],
  milk: ["dairy", "milk", "lactose"],
  egg: ["egg", "eggs"],
  fish: ["fish"],
  shellfish: ["shellfish"],
  soy: ["soy", "soya"],
  wheat: ["wheat", "gluten"],
  gluten: ["gluten", "wheat"],
  sesame: ["sesame"],
};

const PHRASE_TO_ALLERGEN: Record<string, string> = {
  cheese: "milk",
  butter: "milk",
  cream: "milk",
  yogurt: "milk",
  yoghurt: "milk",
  buttermilk: "milk",
  mayo: "egg",
  mayonnaise: "egg",
  aioli: "egg",
  pesto: "tree_nut",
  nutella: "tree_nut",
};

function lookupHints(code: string): string[] {
  return FREE_CLAIM_HINTS[code] ?? [code.replace(/_/g, " ")];
}

export function freeClaimHintsForAllergen(allergenCode: string): string[] {
  const hints = new Set<string>(lookupHints(allergenCode));
  for (const ancestor of getAncestors(allergenCode)) {
    for (const hint of lookupHints(ancestor)) hints.add(hint);
  }
  return [...hints];
}

function lineHasFreeClaim(line: string, hint: string): boolean {
  const options = { ignoreCompoundFoods: true, ignoreFalseFriends: true, ignoreNegation: true };
  return (
    phraseMatchesLine(`${hint} free`, line, options) ||
    phraseMatchesLine(`no ${hint}`, line, options) ||
    phraseMatchesLine(`without ${hint}`, line, options)
  );
}

/** True when the line claims it is free of this allergen family. */
export function lineNegatesAllergen(line: string, allergenCode: string): boolean {
  return freeClaimHintsForAllergen(allergenCode).some((hint) => lineHasFreeClaim(line, hint));
}

/** True when a custom/diet phrase is covered by a free-of claim on the line. */
export function lineNegatesPhrase(line: string, phrase: string): boolean {
  if (lineHasFreeClaim(line, phrase)) return true;
  const normalized = phrase.toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
  const mapped = PHRASE_TO_ALLERGEN[normalized];
  if (mapped && lineNegatesAllergen(line, mapped)) return true;
  for (const [code, hints] of Object.entries(FREE_CLAIM_HINTS)) {
    if (hints.includes(normalized) && lineNegatesAllergen(line, code)) return true;
  }
  return false;
}
