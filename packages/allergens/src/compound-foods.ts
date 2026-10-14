/**
 * Compound-food exclusions for phrase matching.
 *
 * A short food phrase must not match when it only appears as part of a
 * different, longer food. Families configure rules per person; this list is
 * shared reference data, not a hidden household policy.
 */

export interface CompoundFoodExclusion {
  /** Shorter phrase from a rule or allergen mapping */
  phrase: string;
  /** Longer foods that contain the phrase but are a different food */
  compounds: string[];
}

export const defaultCompoundFoodExclusions: CompoundFoodExclusion[] = [
  { phrase: "olive", compounds: ["olive oil"] },
  { phrase: "olives", compounds: ["olive oil"] },
  {
    phrase: "milk",
    compounds: [
      "coconut milk",
      "almond milk",
      "oat milk",
      "soy milk",
      "soya milk",
      "rice milk",
      "cashew milk",
      "hemp milk",
      "pea milk",
      "flax milk",
      "walnut milk",
      "macadamia milk",
      "pistachio milk",
      "hazelnut milk",
    ],
  },
  {
    phrase: "cream",
    compounds: ["cream of tartar", "coconut cream", "creamed honey", "salad cream"],
  },
  {
    phrase: "butter",
    compounds: [
      "peanut butter",
      "almond butter",
      "cashew butter",
      "hazelnut butter",
      "walnut butter",
      "pistachio butter",
      "sunflower butter",
      "seed butter",
      "nut butter",
      "apple butter",
      "cocoa butter",
      "cacao butter",
      "shea butter",
      "butter lettuce",
      "butter bean",
      "butter beans",
    ],
  },
  { phrase: "butternut", compounds: ["butternut squash"] },
  { phrase: "nut", compounds: ["nutmeg", "coconut"] },
  { phrase: "nuts", compounds: ["coconut"] },
  { phrase: "flour", compounds: ["rice flour", "chickpea flour", "oat flour", "corn flour"] },
  { phrase: "wheat", compounds: ["buckwheat"] },
  {
    phrase: "pesto",
    compounds: ["sunflower seed pesto", "pumpkin seed pesto", "seed pesto", "nut free pesto"],
  },
];

function normalizeExclusionKey(value: string): string {
  return value.toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
}

const exclusionIndex: Map<string, string[]> = (() => {
  const map = new Map<string, string[]>();
  for (const entry of defaultCompoundFoodExclusions) {
    const key = normalizeExclusionKey(entry.phrase);
    const existing = map.get(key) ?? [];
    for (const compound of entry.compounds) {
      if (!existing.includes(compound)) existing.push(compound);
    }
    map.set(key, existing);
  }
  return map;
})();

/** Compounds that should suppress a match for `phrase`. */
export function compoundsExcludingPhrase(phrase: string): string[] {
  return exclusionIndex.get(normalizeExclusionKey(phrase)) ?? [];
}
