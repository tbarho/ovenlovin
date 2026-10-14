/**
 * Searchable catalogs for the People / Rules UI.
 *
 * Allergen entries come from the taxonomy tree. Diet entries are common
 * household patterns — they are not hard-coded policies; a person still
 * needs an explicit rule with a chosen severity.
 */

import { allergenTaxonomy, type AllergenTaxonomyNode } from "./taxonomy";

export type RuleIntent = "allergy" | "diet" | "dislike" | "love";

export type CatalogGroup = "allergen" | "diet" | "ingredient" | "cuisine" | "style";

export interface CatalogEntry {
  code: string;
  name: string;
  /** Lowercase phrase used in chips, e.g. "tree nuts" */
  phraseName: string;
  description?: string;
  group: CatalogGroup;
  parent?: string;
  parentName?: string;
  aliases: string[];
  featured?: boolean;
}

export interface DietCatalogEntry {
  code: string;
  name: string;
  phraseName: string;
  description: string;
  aliases: string[];
  /** Ingredient phrases this diet rule matches. Not a hidden policy — only used when the person has this diet rule. */
  matchPhrases?: string[];
}

export const dietCatalog: DietCatalogEntry[] = [
  {
    code: "vegetarian",
    name: "Vegetarian",
    phraseName: "vegetarian diet",
    description: "No meat, poultry, or fish",
    aliases: ["veg", "veggie", "no meat"],
    matchPhrases: [
      "beef",
      "chicken",
      "pork",
      "turkey",
      "lamb",
      "steak",
      "bacon",
      "ham",
      "sausage",
      "meat",
      "fish",
      "salmon",
      "tuna",
      "shrimp",
      "gelatin",
    ],
  },
  {
    code: "vegan",
    name: "Vegan",
    phraseName: "vegan diet",
    description: "No animal products",
    aliases: ["plant based", "plant-based"],
    matchPhrases: [
      "beef",
      "chicken",
      "pork",
      "turkey",
      "lamb",
      "steak",
      "bacon",
      "ham",
      "sausage",
      "meat",
      "fish",
      "salmon",
      "tuna",
      "shrimp",
      "gelatin",
      "milk",
      "cheese",
      "butter",
      "cream",
      "egg",
      "eggs",
      "honey",
      "yogurt",
      "whey",
    ],
  },
  {
    code: "pescatarian",
    name: "Pescatarian",
    phraseName: "pescatarian diet",
    description: "Fish allowed; no meat or poultry",
    aliases: ["pesce", "fish"],
    matchPhrases: [
      "beef",
      "chicken",
      "pork",
      "turkey",
      "lamb",
      "steak",
      "bacon",
      "ham",
      "sausage",
      "meat",
    ],
  },
  {
    code: "gluten_free",
    name: "Gluten-free",
    phraseName: "gluten-free diet",
    description: "Avoid wheat, barley, rye, and other gluten grains",
    aliases: ["gluten free", "celiac", "coeliac", "gf"],
    matchPhrases: ["wheat", "barley", "rye", "gluten"],
  },
  {
    code: "dairy_free",
    name: "Dairy-free",
    phraseName: "dairy-free diet",
    description: "Avoid milk and dairy products",
    aliases: ["dairy free", "no dairy", "lactose"],
    matchPhrases: ["milk", "cheese", "butter", "cream", "yogurt", "whey"],
  },
  {
    code: "kosher",
    name: "Kosher",
    phraseName: "kosher diet",
    description: "Follow kosher dietary law",
    aliases: ["kashrut"],
  },
  {
    code: "halal",
    name: "Halal",
    phraseName: "halal diet",
    description: "Follow halal dietary law",
    aliases: [],
  },
  {
    code: "paleo",
    name: "Paleo",
    phraseName: "paleo diet",
    description: "Paleolithic-style eating pattern",
    aliases: ["paleolithic"],
  },
  {
    code: "keto",
    name: "Keto",
    phraseName: "keto diet",
    description: "Very low carbohydrate, high fat",
    aliases: ["ketogenic", "low carb"],
  },
  {
    code: "low_carb",
    name: "Low-carb",
    phraseName: "low-carb diet",
    description: "Limit carbohydrate-rich foods",
    aliases: ["low carb", "low carbohydrate"],
  },
];

const FEATURED_ALLERGENS = [
  "peanut",
  "tree_nut",
  "milk",
  "egg",
  "fish",
  "shellfish",
  "soy",
  "wheat",
  "sesame",
  "gluten",
] as const;

const PHRASE_NAMES: Record<string, string> = {
  peanut: "peanuts",
  tree_nut: "tree nuts",
  milk: "dairy",
  egg: "eggs",
  fish: "fish",
  shellfish: "shellfish",
  soy: "soy",
  wheat: "wheat",
  sesame: "sesame",
  gluten: "gluten",
  coconut: "coconut",
  almond: "almonds",
  cashew: "cashews",
  pecan: "pecans",
  walnut: "walnuts",
  pistachio: "pistachios",
  hazelnut: "hazelnuts",
  macadamia: "macadamias",
  brazil_nut: "Brazil nuts",
  pine_nut: "pine nuts",
  chestnut: "chestnuts",
};

const EXTRA_ALIASES: Record<string, string[]> = {
  peanut: ["peanuts", "groundnut", "groundnuts", "nut", "nuts", "all nuts"],
  tree_nut: ["tree nuts", "nut", "nuts", "all nuts", "tree nut"],
  milk: ["dairy", "cow milk", "lactose", "cheese", "butter", "cream"],
  egg: ["eggs", "albumin"],
  shellfish: ["shrimp", "crab", "lobster", "shell fish"],
  gluten: ["gluten free", "celiac", "wheat"],
  coconut: ["cocoanut"],
  hazelnut: ["filbert", "filberts"],
  pine_nut: ["pignoli", "pinon", "piñon"],
};

function humanizeCode(code: string): string {
  return code
    .split("_")
    .map((part) => (part ? part[0]!.toUpperCase() + part.slice(1) : part))
    .join(" ");
}

function phraseNameFor(code: string, name: string): string {
  return PHRASE_NAMES[code] ?? name.toLowerCase();
}

function flattenAllergens(
  nodes: AllergenTaxonomyNode[],
  parent?: { code: string; name: string }
): CatalogEntry[] {
  const entries: CatalogEntry[] = [];
  for (const node of nodes) {
    entries.push({
      code: node.code,
      name: node.name,
      phraseName: phraseNameFor(node.code, node.name),
      description: node.description,
      group: "allergen",
      parent: parent?.code,
      parentName: parent?.name,
      aliases: EXTRA_ALIASES[node.code] ?? [],
      featured: FEATURED_ALLERGENS.includes(node.code as (typeof FEATURED_ALLERGENS)[number]),
    });
    if (node.children) {
      entries.push(...flattenAllergens(node.children, { code: node.code, name: node.name }));
    }
  }
  return entries;
}

let allergenEntriesCache: CatalogEntry[] | null = null;

export function allergenCatalog(): CatalogEntry[] {
  if (!allergenEntriesCache) {
    allergenEntriesCache = flattenAllergens(allergenTaxonomy);
  }
  return allergenEntriesCache;
}

export function dietCatalogEntries(): CatalogEntry[] {
  return dietCatalog.map((diet) => ({
    code: diet.code,
    name: diet.name,
    phraseName: diet.phraseName,
    description: diet.description,
    group: "diet" as const,
    aliases: diet.aliases,
    featured: true,
  }));
}

export const dislikeCatalog: CatalogEntry[] = [
  {
    code: "cilantro",
    name: "Cilantro",
    phraseName: "cilantro",
    description: "Fresh coriander leaf",
    group: "ingredient",
    aliases: ["coriander", "coriander leaf"],
  },
  {
    code: "olives",
    name: "Olives",
    phraseName: "olives",
    group: "ingredient",
    aliases: ["olive"],
  },
  {
    code: "mushrooms",
    name: "Mushrooms",
    phraseName: "mushrooms",
    group: "ingredient",
    aliases: ["mushroom"],
  },
  {
    code: "onions",
    name: "Onions",
    phraseName: "onions",
    group: "ingredient",
    aliases: ["onion"],
  },
  {
    code: "garlic",
    name: "Garlic",
    phraseName: "garlic",
    group: "ingredient",
    aliases: [],
  },
  {
    code: "spicy",
    name: "Spicy food",
    phraseName: "spicy food",
    group: "ingredient",
    aliases: ["spice", "hot"],
  },
];

export const loveCatalog: CatalogEntry[] = [
  {
    code: "salmon",
    name: "Salmon",
    phraseName: "salmon",
    group: "ingredient",
    aliases: [],
    featured: true,
  },
  {
    code: "spicy",
    name: "Spicy",
    phraseName: "spicy",
    description: "Heat, chiles, hot sauce",
    group: "style",
    aliases: ["spice", "hot", "chile", "chili"],
    featured: true,
  },
  {
    code: "mexican",
    name: "Mexican",
    phraseName: "Mexican",
    group: "cuisine",
    aliases: ["taco", "tacos", "mexico"],
    featured: true,
  },
  {
    code: "italian",
    name: "Italian",
    phraseName: "Italian",
    group: "cuisine",
    aliases: ["pasta", "italy"],
    featured: true,
  },
  {
    code: "chinese",
    name: "Chinese",
    phraseName: "Chinese",
    group: "cuisine",
    aliases: ["china"],
    featured: true,
  },
  {
    code: "american",
    name: "American",
    phraseName: "American",
    group: "cuisine",
    aliases: [],
    featured: true,
  },
  {
    code: "chicken",
    name: "Chicken",
    phraseName: "chicken",
    group: "ingredient",
    aliases: [],
    featured: true,
  },
  {
    code: "pasta",
    name: "Pasta",
    phraseName: "pasta",
    group: "ingredient",
    aliases: ["noodle", "noodles"],
    featured: true,
  },
  {
    code: "chocolate",
    name: "Chocolate",
    phraseName: "chocolate",
    group: "ingredient",
    aliases: [],
    featured: true,
  },
  {
    code: "sheet_pan",
    name: "Sheet pan",
    phraseName: "sheet pan",
    group: "style",
    aliases: ["sheetpan", "one pan"],
    featured: true,
  },
];

export function catalogForIntent(intent: RuleIntent): CatalogEntry[] {
  if (intent === "allergy") return allergenCatalog();
  if (intent === "diet") return dietCatalogEntries();
  if (intent === "love") return loveCatalog;
  return dislikeCatalog;
}

export function allCatalogEntries(): CatalogEntry[] {
  return [...allergenCatalog(), ...dietCatalogEntries(), ...dislikeCatalog, ...loveCatalog];
}

export function findCatalogEntry(code: string, group?: CatalogGroup): CatalogEntry | undefined {
  const pools =
    group === "diet"
      ? dietCatalogEntries()
      : group === "allergen"
        ? allergenCatalog()
        : group === "ingredient"
          ? [...dislikeCatalog, ...loveCatalog.filter((entry) => entry.group === "ingredient")]
          : group === "cuisine" || group === "style"
            ? loveCatalog.filter((entry) => entry.group === group)
            : allCatalogEntries();
  return pools.find((entry) => entry.code === code);
}

export function matchPhrasesForTarget(target: string, kind?: string): string[] {
  const phrases = new Set<string>([target]);
  const diet = dietCatalog.find((entry) => entry.code === target);
  if (diet) {
    for (const phrase of diet.aliases) phrases.add(phrase);
    for (const phrase of diet.matchPhrases ?? []) phrases.add(phrase);
  }
  const entry =
    kind === "diet"
      ? findCatalogEntry(target, "diet")
      : kind === "allergen"
        ? findCatalogEntry(target, "allergen")
        : findCatalogEntry(target);
  if (entry) {
    phrases.add(entry.name);
    phrases.add(entry.phraseName);
    for (const alias of entry.aliases) phrases.add(alias);
  }
  return [...phrases];
}

export function normalizeSearch(value: string): string {
  return value.toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
}

function entryHaystack(entry: CatalogEntry): string {
  return normalizeSearch(
    [entry.code, entry.name, entry.phraseName, entry.description ?? "", ...entry.aliases].join(" ")
  );
}

function scoreEntry(entry: CatalogEntry, query: string): number {
  if (!query) return entry.featured ? 20 : 0;
  const name = normalizeSearch(entry.name);
  const phrase = normalizeSearch(entry.phraseName);
  const code = normalizeSearch(entry.code);
  if (name === query || phrase === query || code === query) return 100;
  if (entry.aliases.some((alias) => normalizeSearch(alias) === query)) return 90;
  if (name.startsWith(query) || phrase.startsWith(query)) return 80;
  if (entry.aliases.some((alias) => normalizeSearch(alias).startsWith(query))) return 70;
  if (entryHaystack(entry).includes(query)) return entry.featured ? 60 : 50;
  return 0;
}

export function searchCatalog(
  query: string,
  options: { intent?: RuleIntent; limit?: number } = {}
): CatalogEntry[] {
  const intent = options.intent ?? "allergy";
  const limit = options.limit ?? 20;
  const pool = catalogForIntent(intent);
  const normalized = normalizeSearch(query);

  const ranked = pool
    .map((entry) => ({ entry, score: scoreEntry(entry, normalized) }))
    .filter((row) => (normalized ? row.score > 0 : true))
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.entry.name.localeCompare(b.entry.name);
    })
    .map((row) => row.entry);

  if (!normalized) {
    const featured = ranked.filter((entry) => entry.featured);
    return (featured.length > 0 ? featured : ranked).slice(0, limit);
  }

  return ranked.slice(0, limit);
}

export function humanizeTarget(target: string): string {
  const entry = findCatalogEntry(target);
  if (entry) return entry.phraseName;
  return phraseNameFor(target, humanizeCode(target));
}

export function displayNameForTarget(target: string): string {
  const entry = findCatalogEntry(target);
  if (entry) return entry.name;
  return humanizeCode(target);
}
