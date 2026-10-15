/**
 * High-signal phrases that mean "this line might be allergen X".
 * Used only to mark a check incomplete when we cannot classify the line.
 * Not a household policy - findings still come from per-person rules.
 */

import { getDescendants } from "./taxonomy";

const HINTS_BY_CODE: Record<string, string[]> = {
  peanut: ["peanut", "peanuts", "groundnut", "groundnuts", "satay", "sate", "kung pao", "arachis"],
  tree_nut: [
    "tree nut",
    "tree nuts",
    "nut",
    "nuts",
    "pesto",
    "nutella",
    "marzipan",
    "praline",
    "nougat",
    "baklava",
    "gianduja",
    "frangipane",
    "romesco",
    "dukkah",
  ],
  almond: ["almond", "almonds", "marzipan", "frangipane", "amaretti", "macaron", "macarons"],
  cashew: ["cashew", "cashews"],
  pecan: ["pecan", "pecans"],
  walnut: ["walnut", "walnuts"],
  pistachio: ["pistachio", "pistachios"],
  hazelnut: ["hazelnut", "hazelnuts", "filbert", "filberts", "nutella", "gianduja"],
  macadamia: ["macadamia", "macadamias"],
  brazil_nut: ["brazil nut", "brazil nuts"],
  pine_nut: ["pine nut", "pine nuts", "pignoli", "pesto"],
  chestnut: ["chestnut", "chestnuts"],
  coconut: ["coconut", "coconuts"],
  milk: [
    "milk",
    "dairy",
    "butter",
    "cream",
    "cheese",
    "buttermilk",
    "whey",
    "casein",
    "lactose",
    "yogurt",
    "yoghurt",
    "ghee",
    "parmesan",
    "cheddar",
    "mozzarella",
  ],
  egg: ["egg", "eggs", "mayo", "mayonnaise", "aioli", "meringue", "albumin"],
  fish: ["fish", "salmon", "tuna", "cod", "anchovy", "anchovies", "fish sauce", "worcestershire"],
  shellfish: ["shellfish", "shrimp", "prawn", "prawns", "crab", "lobster", "crawfish", "crayfish"],
  crustacean: ["shrimp", "prawn", "crab", "lobster", "crayfish"],
  mollusk: ["clam", "oyster", "mussel", "scallop", "squid", "octopus", "calamari"],
  shrimp: ["shrimp", "prawn", "prawns"],
  crab: ["crab"],
  lobster: ["lobster"],
  soy: ["soy", "soya", "soybean", "tofu", "edamame", "miso", "tempeh", "tamari"],
  wheat: ["wheat", "flour", "seitan", "couscous", "bulgur", "semolina", "durum"],
  gluten: ["gluten", "wheat", "barley", "rye", "malt", "seitan"],
  barley: ["barley", "malt"],
  rye: ["rye"],
  sesame: ["sesame", "tahini", "tahina", "hummus"],
  mustard: ["mustard"],
  celery: ["celery", "celeriac"],
  lupin: ["lupin", "lupine"],
  sulfite: ["sulfite", "sulfites", "sulphite", "sulphites"],
};

/**
 * Hint phrases for a rule target, including taxonomy descendants.
 * Coconut is included for tree_nut only when the rule says so.
 */
export function hintPhrasesForTarget(
  target: string,
  options: { treatCoconutAsTreeNut?: boolean } = {}
): string[] {
  const phrases = new Set<string>(HINTS_BY_CODE[target] ?? [target]);
  for (const descendant of getDescendants(target)) {
    for (const hint of HINTS_BY_CODE[descendant] ?? [descendant]) {
      phrases.add(hint);
    }
  }
  if (target === "tree_nut" && options.treatCoconutAsTreeNut) {
    for (const hint of HINTS_BY_CODE.coconut ?? []) phrases.add(hint);
  }
  return [...phrases];
}
