/**
 * Searchable catalogs for the People / Rules UI.
 *
 * Allergen entries come from the taxonomy tree. Diet entries are common
 * household patterns - they are not hard-coded policies; a person still
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
  /** Ingredient phrases this diet rule matches. Not a hidden policy - only used when the person has this diet rule. */
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
  milk: [
    "dairy",
    "cow milk",
    "cows milk",
    "cow's milk",
    "lactose",
    "cheese",
    "butter",
    "cream",
    "dairy products",
    "milk products",
  ],
  egg: ["eggs", "albumin", "chicken egg", "chicken eggs"],
  fish: ["finned fish", "fishes"],
  shellfish: ["shrimp", "crab", "lobster", "shell fish"],
  soy: ["soya", "soybean", "soybeans", "soy bean", "soy beans", "soya bean", "edamame"],
  wheat: ["wheat flour", "wheats"],
  sesame: ["sesame seeds", "sesame seed", "sesame oil", "tahini", "tahina", "benne", "benne seed"],
  gluten: ["gluten free", "celiac", "wheat"],
  mustard: ["mustard seed", "mustard seeds"],
  celery: ["celeriac", "celery root"],
  lupin: ["lupine", "lupini", "lupins"],
  sulfite: ["sulfites", "sulphite", "sulphites", "sulfur dioxide"],
  coconut: ["cocoanut"],
  almond: ["almonds"],
  cashew: ["cashews"],
  pecan: ["pecans"],
  walnut: ["walnuts"],
  pistachio: ["pistachios"],
  hazelnut: ["filbert", "filberts", "hazelnuts"],
  macadamia: ["macadamias", "macadamia nut", "macadamia nuts"],
  brazil_nut: ["brazil nuts", "brazil nut"],
  pine_nut: ["pignoli", "pinon", "piñon", "pine nuts", "pine nut"],
  chestnut: ["chestnuts"],
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

function slugCatalogCode(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

function intentForRuleKind(kind?: string): RuleIntent {
  if (kind === "diet") return "diet";
  if (kind === "ingredient" || kind === "ingredient_category" || kind === "tag") return "dislike";
  return "allergy";
}

export function catalogGroupForRuleKind(kind?: string): CatalogGroup | undefined {
  if (kind === "allergen") return "allergen";
  if (kind === "diet") return "diet";
  if (kind === "ingredient" || kind === "ingredient_category") return "ingredient";
  return undefined;
}

export function ruleKindForCatalogGroup(group: CatalogGroup): "allergen" | "diet" | "ingredient" {
  if (group === "allergen") return "allergen";
  if (group === "diet") return "diet";
  return "ingredient";
}

function catalogPools(group?: CatalogGroup): CatalogEntry[] {
  if (group === "diet") return dietCatalogEntries();
  if (group === "allergen") return allergenCatalog();
  if (group === "ingredient") {
    return [...dislikeCatalog, ...loveCatalog.filter((entry) => entry.group === "ingredient")];
  }
  if (group === "cuisine" || group === "style") {
    return loveCatalog.filter((entry) => entry.group === group);
  }
  return allCatalogEntries();
}

function entryMatchesPhrase(entry: CatalogEntry, query: string): boolean {
  const q = normalizeSearch(query);
  const slug = slugCatalogCode(query);
  if (!q && !slug) return false;
  const phrases = [entry.code, entry.name, entry.phraseName, ...entry.aliases];
  return phrases.some((phrase) => {
    if (normalizeSearch(phrase) === q) return true;
    return Boolean(slug) && slugCatalogCode(phrase) === slug;
  });
}

function findCatalogEntryByPhrase(query: string, group?: CatalogGroup): CatalogEntry | undefined {
  const matches = catalogPools(group).filter((entry) => entryMatchesPhrase(entry, query));
  if (matches.length === 0) return undefined;
  return matches.find((entry) => entry.featured) ?? matches[0];
}

/**
 * Canonicalize a typed allergen/diet/ingredient the same way the People UI
 * does (`resolveFoodAdd`): exact catalog codes win, then common phrases
 * ("sesame seeds"), then searchCatalog typos such as "pean" → peanut.
 */
export function resolveCatalogTarget(
  query: string,
  options: { kind?: string } = {}
): CatalogEntry | null {
  const q = query.trim();
  if (!q) return null;
  const slug = slugCatalogCode(q);
  const group = catalogGroupForRuleKind(options.kind);
  const exact =
    (slug ? findCatalogEntry(slug, group) : undefined) ??
    (slug ? findCatalogEntry(slug) : undefined) ??
    findCatalogEntry(q, group) ??
    findCatalogEntry(q);
  if (exact) return exact;

  const phrase =
    findCatalogEntryByPhrase(q, group) ?? (group ? findCatalogEntryByPhrase(q) : undefined);
  if (phrase) return phrase;

  const primary = intentForRuleKind(options.kind);
  const intents: RuleIntent[] = [];
  for (const intent of [primary, "allergy", "diet", "dislike"] as const) {
    if (!intents.includes(intent)) intents.push(intent);
  }
  for (const intent of intents) {
    const match = searchCatalog(q, { intent, limit: 8 })[0];
    if (match) return match;
  }
  return fuzzyCatalogMatch(q, group);
}

export type PersonRuleKind =
  "allergen" | "ingredient" | "ingredient_category" | "diet" | "tag" | "custom";

export function canonicalizePersonRuleTarget(
  kind: PersonRuleKind,
  target: string
): {
  kind: PersonRuleKind;
  target: string;
  canonicalized: boolean;
  resolved: boolean;
} {
  const resolved = resolveCatalogTarget(target, { kind });
  if (!resolved) {
    return { kind, target: target.trim(), canonicalized: false, resolved: false };
  }
  const nextKind: PersonRuleKind =
    kind === "custom" || kind === "tag" || kind === "ingredient_category"
      ? kind
      : ruleKindForCatalogGroup(resolved.group);
  return {
    kind: nextKind,
    target: resolved.code,
    canonicalized: resolved.code !== target.trim() || nextKind !== kind,
    resolved: true,
  };
}

export function unknownRuleTargetMessage(target: string): string {
  return `We can't check '${target.trim()}' against recipes. If you meant this exact food, retry with confirmUnknown: true.`;
}

function editDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  const next = new Array<number>(b.length + 1);
  for (let i = 0; i < a.length; i++) {
    next[0] = i + 1;
    for (let j = 0; j < b.length; j++) {
      const cost = a[i] === b[j] ? 0 : 1;
      next[j + 1] = Math.min((next[j] ?? 0) + 1, (prev[j + 1] ?? 0) + 1, (prev[j] ?? 0) + cost);
    }
    prev.splice(0, prev.length, ...next);
  }
  return prev[b.length] ?? Math.max(a.length, b.length);
}

function fuzzyCatalogMatch(query: string, group?: CatalogGroup): CatalogEntry | null {
  const q = normalizeSearch(query);
  if (q.length < 4) return null;
  const maxDist = q.length <= 5 ? 1 : 2;
  let best: CatalogEntry | null = null;
  let bestDist = maxDist + 1;
  for (const entry of allCatalogEntries()) {
    if (group && entry.group !== group && group === "allergen" && entry.group !== "allergen") {
      continue;
    }
    const candidates = [entry.code, entry.name, entry.phraseName, ...entry.aliases].map(
      normalizeSearch
    );
    for (const candidate of candidates) {
      if (!candidate || Math.abs(candidate.length - q.length) > maxDist) continue;
      const dist = editDistance(q, candidate);
      if (dist < bestDist && dist <= maxDist) {
        best = entry;
        bestDist = dist;
      }
    }
  }
  return best;
}

export function findCatalogEntry(code: string, group?: CatalogGroup): CatalogEntry | undefined {
  return catalogPools(group).find((entry) => entry.code === code);
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

  if (ranked.length === 0) {
    const fuzzy = fuzzyCatalogMatch(normalized);
    if (fuzzy) return [fuzzy];
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
