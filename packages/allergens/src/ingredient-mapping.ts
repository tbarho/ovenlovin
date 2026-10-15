/**
 * Ingredient-to-allergen mappings
 *
 * Maps ingredient names (with aliases, plurals, misspellings, and OCR variants)
 * to allergen codes with relation types.
 *
 * This is reference data the checker uses; whether a match matters is decided
 * only by each person's rules.
 */

import type { AllergenRelation } from "@ovenlovin/core";
import { lineNegatesAllergen } from "./negation";
import { findPhraseStarts, phraseTokens, registerNegationCompounds } from "./phrase-match";

export interface IngredientAllergenMapping {
  /** Canonical ingredient name */
  name: string;
  /** All known aliases, including plurals, misspellings, OCR variants, foreign names */
  aliases: string[];
  /** Allergen code from taxonomy */
  allergenCode: string;
  /** Relation type */
  relation: AllergenRelation;
  /** Additional notes */
  notes?: string;
}

/**
 * Comprehensive ingredient-to-allergen mapping database
 *
 * Thoroughly covers peanut and tree nuts per spec requirements, including:
 * - Hidden nuts in compound foods (pesto, marzipan, praline, satay, baklava, etc.)
 * - Common misspellings and OCR errors
 * - Plurals and alternate spellings
 * - Foreign language names
 * - Derived products (oils, butters, flours, milks)
 */
export const ingredientAllergenMappings: IngredientAllergenMapping[] = [
  // ===== PEANUT =====
  {
    name: "peanut",
    aliases: [
      "peanuts",
      "peanut butter",
      "groundnut",
      "groundnuts",
      "goober",
      "goobers",
      "monkey nut",
      "monkey nuts",
      "cacahuate",
      "cacahuetes",
      "mani",
      "arachis",
      "peanut oil",
      "groundnut oil",
      "peanut flour",
      // OCR / misspellings
      "peanu",
      "penuts",
      "penauts",
    ],
    allergenCode: "peanut",
    relation: "contains",
  },
  {
    name: "satay sauce",
    aliases: ["satay", "sate", "peanut sauce", "gado gado", "gado-gado", "pad thai sauce"],
    allergenCode: "peanut",
    relation: "contains",
    notes: "Southeast Asian sauce typically made with peanuts",
  },
  {
    name: "kung pao sauce",
    aliases: ["kung pao", "gong bao", "kung po"],
    allergenCode: "peanut",
    relation: "contains",
    notes: "Chinese dish commonly includes peanuts",
  },

  // ===== TREE NUTS - ALMOND =====
  {
    name: "almond",
    aliases: [
      "almonds",
      "sweet almond",
      "amande",
      "mandel",
      "almendra",
      "almond butter",
      "almond oil",
      "almond flour",
      "almond meal",
      "almond milk",
      "almond paste",
      "almond extract",
      // OCR / misspellings
      "alrnond",
      "amond",
    ],
    allergenCode: "almond",
    relation: "contains",
  },
  {
    name: "marzipan",
    aliases: [
      "marchpane",
      "massepain",
      "mazapan",
      "marzipan paste",
      // OCR / misspellings
      "marzi pan",
      "marzapan",
    ],
    allergenCode: "almond",
    relation: "contains",
    notes: "Confection made from almond paste and sugar",
  },
  {
    name: "frangipane",
    aliases: ["almond cream", "frangipani cream"],
    allergenCode: "almond",
    relation: "contains",
    notes: "Almond-based pastry cream",
  },

  // ===== TREE NUTS - CASHEW =====
  {
    name: "cashew",
    aliases: [
      "cashews",
      "cashew nut",
      "cashew nuts",
      "kaju",
      "caju",
      "anacardium",
      "cashew butter",
      "cashew milk",
      // OCR / misspellings
      "cashe w",
      "cashw",
    ],
    allergenCode: "cashew",
    relation: "contains",
  },

  // ===== TREE NUTS - PECAN =====
  {
    name: "pecan",
    aliases: [
      "pecans",
      "pecan nut",
      "pecan nuts",
      "pecan pie",
      // OCR / misspellings
      "pecons",
      "pecan",
      "peca n",
    ],
    allergenCode: "pecan",
    relation: "contains",
  },

  // ===== TREE NUTS - WALNUT =====
  {
    name: "walnut",
    aliases: [
      "walnuts",
      "walnut halves",
      "walnut pieces",
      "noix",
      "noci",
      "nuez",
      "walnut oil",
      // OCR / misspellings
      "walnu t",
      "waInut",
    ],
    allergenCode: "walnut",
    relation: "contains",
  },
  {
    name: "black walnut",
    aliases: ["black walnuts"],
    allergenCode: "black_walnut",
    relation: "contains",
  },
  {
    name: "english walnut",
    aliases: ["english walnuts", "persian walnut"],
    allergenCode: "english_walnut",
    relation: "contains",
  },

  // ===== TREE NUTS - PISTACHIO =====
  {
    name: "pistachio",
    aliases: [
      "pistachios",
      "pista",
      "pistache",
      "pistachio nut",
      "pistachio nuts",
      // OCR / misspellings
      "pistacio",
      "pistachio s",
    ],
    allergenCode: "pistachio",
    relation: "contains",
  },

  // ===== TREE NUTS - HAZELNUT =====
  {
    name: "hazelnut",
    aliases: [
      "hazelnuts",
      "filbert",
      "filberts",
      "cob nut",
      "cob nuts",
      "cobnut",
      "cobnuts",
      "hazelnut butter",
      "hazelnut oil",
      "hazelnut paste",
      "noisette",
      "nocciola",
      "nocciole",
      "haselnuss",
      "haselnusse",
      "ground hazelnuts",
      // OCR / misspellings
      "hazelnu t",
      "hazeInut",
      "hazelunt",
    ],
    allergenCode: "hazelnut",
    relation: "contains",
  },
  {
    name: "gianduja",
    aliases: ["gianduia", "chocolate hazelnut", "hazelnut chocolate"],
    allergenCode: "hazelnut",
    relation: "contains",
    notes: "Italian chocolate-hazelnut confection",
  },
  {
    name: "Nutella",
    aliases: ["nutella", "hazelnut spread", "chocolate hazelnut spread"],
    allergenCode: "hazelnut",
    relation: "contains",
    notes: "Hazelnut-cocoa spread",
  },
  {
    name: "Nutella",
    aliases: ["nutella", "hazelnut spread", "chocolate hazelnut spread"],
    allergenCode: "milk",
    relation: "contains",
    notes: "Commercial hazelnut-cocoa spread typically contains milk",
  },

  // ===== TREE NUTS - MACADAMIA =====
  {
    name: "macadamia",
    aliases: [
      "macadamia nut",
      "macadamia nuts",
      "macadamias",
      "queensland nut",
      "maroochi nut",
      // OCR / misspellings
      "macadamia",
      "macadarnia",
      "macadmia",
    ],
    allergenCode: "macadamia",
    relation: "contains",
  },

  // ===== TREE NUTS - BRAZIL NUT =====
  {
    name: "brazil nut",
    aliases: [
      "brazil nuts",
      "brazilnut",
      "brazilnuts",
      "para nut",
      "cream nut",
      // OCR / misspellings
      "brazi I nut",
      "braz il nut",
    ],
    allergenCode: "brazil_nut",
    relation: "contains",
  },

  // ===== TREE NUTS - PINE NUT =====
  {
    name: "pine nut",
    aliases: [
      "pine nuts",
      "pignoli",
      "pignolia",
      "pinon",
      "pinones",
      "piñon",
      "piñones",
      "pinenut",
      "pinenuts",
      // OCR / misspellings
      "pi ne nut",
      "pinenu t",
    ],
    allergenCode: "pine_nut",
    relation: "contains",
  },
  {
    name: "pesto",
    aliases: ["basil pesto", "pesto sauce", "pesto genovese", "pesto alla genovese"],
    allergenCode: "pine_nut",
    relation: "contains",
    notes: "Traditional pesto contains pine nuts or walnuts",
  },

  // ===== TREE NUTS - CHESTNUT =====
  {
    name: "chestnut",
    aliases: [
      "chestnuts",
      "marron",
      "marrons",
      "chestnut flour",
      "chestnut puree",
      "roasted chestnuts",
      // OCR / misspellings
      "chestnu t",
    ],
    allergenCode: "chestnut",
    relation: "contains",
  },

  // ===== TREE NUTS - OTHER =====
  {
    name: "hickory nut",
    aliases: ["hickory nuts"],
    allergenCode: "hickory",
    relation: "contains",
  },
  {
    name: "beechnut",
    aliases: ["beechnuts", "beech nut", "beech nuts"],
    allergenCode: "beechnut",
    relation: "contains",
  },
  {
    name: "butternut nut",
    aliases: ["white walnut", "butternut nuts"],
    allergenCode: "butternut",
    relation: "contains",
  },

  // ===== COMPOUND FOODS WITH TREE NUTS =====
  {
    name: "praline",
    aliases: ["pralines", "pecan praline"],
    allergenCode: "tree_nut",
    relation: "contains",
    notes: "Confection typically made with pecans or almonds",
  },
  {
    name: "nougat",
    aliases: ["torrone", "turron"],
    allergenCode: "tree_nut",
    relation: "contains",
    notes: "Often contains almonds or other tree nuts",
  },
  {
    name: "baklava",
    aliases: ["baklawa"],
    allergenCode: "tree_nut",
    relation: "contains",
    notes: "Middle Eastern pastry typically contains walnuts or pistachios",
  },
  {
    name: "dukkah",
    aliases: ["duqqa", "dukka"],
    allergenCode: "tree_nut",
    relation: "contains",
    notes: "Egyptian spice blend often contains hazelnuts",
  },
  {
    name: "romesco",
    aliases: ["romesco sauce"],
    allergenCode: "tree_nut",
    relation: "contains",
    notes: "Spanish sauce often contains almonds or hazelnuts",
  },
  {
    name: "nut butter",
    aliases: ["mixed nut butter", "tree nut butter"],
    allergenCode: "tree_nut",
    relation: "contains",
  },
  {
    name: "nut oil",
    aliases: ["mixed nut oil", "tree nut oil"],
    allergenCode: "tree_nut",
    relation: "contains",
  },
  {
    name: "nut flour",
    aliases: ["nut meal", "tree nut flour"],
    allergenCode: "tree_nut",
    relation: "contains",
  },
  {
    name: "nut milk",
    aliases: ["tree nut milk"],
    allergenCode: "tree_nut",
    relation: "contains",
  },

  // ===== COCONUT =====
  {
    name: "coconut",
    aliases: [
      "coconuts",
      "coconut oil",
      "coconut milk",
      "coconut cream",
      "coconut flour",
      "coconut flakes",
      "shredded coconut",
      "desiccated coconut",
      "copra",
      // OCR / misspellings
      "coconu t",
    ],
    allergenCode: "coconut",
    relation: "contains",
  },

  // ===== MAY CONTAIN / CROSS CONTACT =====
  {
    name: "chocolate chips",
    aliases: [
      "chocolate chip",
      "semi-sweet chocolate chips",
      "milk chocolate chips",
      "dark chocolate chips",
    ],
    allergenCode: "tree_nut",
    relation: "commonly_cross_contact",
    notes: "Commonly produced in facilities with tree nuts",
  },
  {
    name: "granola",
    aliases: ["granola bar", "granola bars"],
    allergenCode: "tree_nut",
    relation: "commonly_cross_contact",
    notes: "Often contains nuts or produced in facilities with nuts",
  },
  {
    name: "trail mix",
    aliases: ["gorp", "scroggin"],
    allergenCode: "tree_nut",
    relation: "contains",
    notes: "Typically contains peanuts and/or tree nuts",
  },
  {
    name: "mixed nuts",
    aliases: ["chopped nuts", "nuts", "nut pieces"],
    allergenCode: "tree_nut",
    relation: "contains",
    notes: "Unspecified nuts are treated as tree nuts",
  },
  {
    name: "mixed nuts",
    aliases: ["mixed nuts"],
    allergenCode: "peanut",
    relation: "contains",
    notes: "Mixed-nut blends commonly include peanuts",
  },
  {
    name: "energy bar",
    aliases: ["protein bar", "nutrition bar"],
    allergenCode: "tree_nut",
    relation: "commonly_cross_contact",
    notes: "Often produced in facilities with nuts",
  },
  {
    name: "brownies",
    aliases: ["brownie"],
    allergenCode: "tree_nut",
    relation: "commonly_cross_contact",
    notes: "Often contain nuts or produced in facilities with nuts",
  },
  {
    name: "cookies",
    aliases: ["cookie"],
    allergenCode: "tree_nut",
    relation: "commonly_cross_contact",
    notes: "Often contain nuts or produced in facilities with nuts",
  },
  {
    name: "cereal",
    aliases: ["breakfast cereal"],
    allergenCode: "tree_nut",
    relation: "commonly_cross_contact",
    notes: "Often produced in facilities with nuts",
  },
  {
    name: "muesli",
    aliases: [],
    allergenCode: "tree_nut",
    relation: "commonly_cross_contact",
    notes: "Often contains nuts",
  },
  {
    name: "snack mix",
    aliases: ["party mix"],
    allergenCode: "tree_nut",
    relation: "commonly_cross_contact",
    notes: "Often contains or is produced with nuts",
  },
  {
    name: "nut brittle",
    aliases: [],
    allergenCode: "tree_nut",
    relation: "contains",
    notes: "Candy containing nuts",
  },
  {
    name: "peanut brittle",
    aliases: [],
    allergenCode: "peanut",
    relation: "contains",
  },
  {
    name: "nut bar",
    aliases: [],
    allergenCode: "tree_nut",
    relation: "contains",
  },
  {
    name: "amaretti",
    aliases: ["amaretto cookies"],
    allergenCode: "almond",
    relation: "contains",
    notes: "Italian almond cookies",
  },
  {
    name: "macarons",
    aliases: ["macaron"],
    allergenCode: "almond",
    relation: "contains",
    notes: "French almond meringue cookies",
  },
  {
    name: "pad thai",
    aliases: [],
    allergenCode: "peanut",
    relation: "contains",
    notes: "Thai noodle dish often containing peanuts",
  },
  {
    name: "dukkah",
    aliases: ["duqqa", "dukka"],
    allergenCode: "tree_nut",
    relation: "contains",
    notes: "Egyptian spice blend containing nuts",
  },

  // ===== MILK =====
  {
    name: "milk",
    aliases: [
      "whole milk",
      "skim milk",
      "low-fat milk",
      "2% milk",
      "dairy milk",
      "cow's milk",
      "cows milk",
      "lait",
      "leche",
      "milch",
    ],
    allergenCode: "milk",
    relation: "contains",
  },
  {
    name: "cream",
    aliases: [
      "heavy cream",
      "light cream",
      "whipping cream",
      "double cream",
      "single cream",
      "creme",
    ],
    allergenCode: "milk",
    relation: "contains",
  },
  {
    name: "butter",
    aliases: ["salted butter", "unsalted butter", "clarified butter", "ghee", "cultured butter"],
    allergenCode: "milk",
    relation: "contains",
  },
  {
    name: "cheese",
    aliases: [
      "cheddar",
      "mozzarella",
      "parmesan",
      "parmigiano",
      "parmigiano reggiano",
      "grated parmesan",
      "swiss cheese",
      "fromage",
      "queso",
      "käse",
      "feta",
      "ricotta",
      "gouda",
      "brie",
      "provolone",
      "pecorino",
      "romano",
      "gruyere",
      "cottage cheese",
      "goat cheese",
      "mascarpone",
    ],
    allergenCode: "milk",
    relation: "contains",
  },
  {
    name: "yogurt",
    aliases: ["yoghurt", "yogourt", "greek yogurt"],
    allergenCode: "milk",
    relation: "contains",
  },
  {
    name: "sour cream",
    aliases: ["soured cream", "creme fraiche", "crème fraîche"],
    allergenCode: "milk",
    relation: "contains",
  },
  {
    name: "buttermilk",
    aliases: ["butter milk"],
    allergenCode: "milk",
    relation: "contains",
  },
  {
    name: "cream cheese",
    aliases: ["creamed cheese"],
    allergenCode: "milk",
    relation: "contains",
  },
  {
    name: "half and half",
    aliases: ["half-and-half", "half & half"],
    allergenCode: "milk",
    relation: "contains",
  },
  {
    name: "whey",
    aliases: ["whey protein", "whey powder", "casein", "caseinate", "lactose"],
    allergenCode: "milk",
    relation: "contains",
  },
  {
    name: "ice cream",
    aliases: ["gelato", "frozen yogurt"],
    allergenCode: "milk",
    relation: "contains",
  },

  // ===== EGG =====
  {
    name: "egg",
    aliases: [
      "eggs",
      "chicken egg",
      "whole egg",
      "egg white",
      "egg yolk",
      "egg wash",
      "oeuf",
      "huevo",
    ],
    allergenCode: "egg",
    relation: "contains",
  },
  {
    name: "mayonnaise",
    aliases: ["mayo"],
    allergenCode: "egg",
    relation: "contains",
  },
  {
    name: "aioli",
    aliases: ["garlic aioli"],
    allergenCode: "egg",
    relation: "contains",
    notes: "Classic aioli is egg-based",
  },
  {
    name: "meringue",
    aliases: ["egg foam"],
    allergenCode: "egg",
    relation: "contains",
  },

  // ===== SOY =====
  {
    name: "soy",
    aliases: [
      "soy sauce",
      "soya",
      "soybean",
      "soybeans",
      "soy milk",
      "tofu",
      "edamame",
      "soy protein",
      "soy lecithin",
      "miso",
      "tempeh",
      "tamari",
      "soya sauce",
    ],
    allergenCode: "soy",
    relation: "contains",
  },

  // ===== WHEAT / GLUTEN =====
  {
    name: "wheat",
    aliases: [
      "wheat flour",
      "whole wheat",
      "all-purpose flour",
      "all purpose flour",
      "bread flour",
      "durum",
      "semolina",
      "spelt",
      "farro",
      "kamut",
      "seitan",
      "breadcrumbs",
      "bread crumbs",
      "panko",
    ],
    allergenCode: "wheat",
    relation: "contains",
  },
  {
    name: "barley",
    aliases: ["pearl barley", "barley malt"],
    allergenCode: "barley",
    relation: "contains",
  },
  {
    name: "rye",
    aliases: ["rye flour", "rye bread"],
    allergenCode: "rye",
    relation: "contains",
  },

  // ===== SHELLFISH =====
  {
    name: "shrimp",
    aliases: ["prawns", "prawn", "crevette", "gamba", "jumbo shrimp"],
    allergenCode: "shrimp",
    relation: "contains",
  },
  {
    name: "crab",
    aliases: ["crabmeat", "crab meat", "blue crab", "dungeness crab"],
    allergenCode: "crab",
    relation: "contains",
  },
  {
    name: "lobster",
    aliases: ["lobster tail", "rock lobster"],
    allergenCode: "lobster",
    relation: "contains",
  },
  {
    name: "crayfish",
    aliases: ["crawfish", "crawdad"],
    allergenCode: "crayfish",
    relation: "contains",
  },
  {
    name: "clam",
    aliases: ["clams"],
    allergenCode: "clam",
    relation: "contains",
  },
  {
    name: "oyster",
    aliases: ["oysters"],
    allergenCode: "oyster",
    relation: "contains",
  },
  {
    name: "mussel",
    aliases: ["mussels"],
    allergenCode: "mussel",
    relation: "contains",
  },
  {
    name: "scallop",
    aliases: ["scallops"],
    allergenCode: "scallop",
    relation: "contains",
  },
  {
    name: "squid",
    aliases: ["calamari"],
    allergenCode: "squid",
    relation: "contains",
  },
  {
    name: "octopus",
    aliases: ["octopi"],
    allergenCode: "octopus",
    relation: "contains",
  },

  // ===== FISH =====
  {
    name: "fish",
    aliases: [
      "salmon",
      "tuna",
      "cod",
      "halibut",
      "bass",
      "trout",
      "tilapia",
      "mackerel",
      "sardine",
      "sardines",
      "anchovy",
      "anchovies",
      "swordfish",
      "haddock",
      "poisson",
      "pescado",
    ],
    allergenCode: "fish",
    relation: "contains",
  },
  {
    name: "fish sauce",
    aliases: ["nam pla", "nuoc mam", "shottsuru"],
    allergenCode: "fish",
    relation: "contains",
    notes: "Fermented sauce made from fish",
  },
  {
    name: "worcestershire",
    aliases: ["worcestershire sauce", "worcester sauce"],
    allergenCode: "fish",
    relation: "contains",
    notes: "Typically contains anchovies",
  },

  // ===== SESAME =====
  {
    name: "sesame",
    aliases: [
      "sesame seeds",
      "sesame seed",
      "sesame oil",
      "tahini",
      "tahina",
      "sesamum",
      "benne",
      "benne seed",
    ],
    allergenCode: "sesame",
    relation: "contains",
  },
  {
    name: "hummus",
    aliases: ["houmous", "hommus"],
    allergenCode: "sesame",
    relation: "contains",
    notes: "Typically contains tahini (sesame paste)",
  },

  // ===== MUSTARD =====
  {
    name: "mustard",
    aliases: [
      "mustard seed",
      "mustard seeds",
      "dijon mustard",
      "yellow mustard",
      "brown mustard",
      "moutarde",
      "mostaza",
    ],
    allergenCode: "mustard",
    relation: "contains",
  },

  // ===== CELERY =====
  {
    name: "celery",
    aliases: ["celery seed", "celery seeds", "celery salt", "celeriac", "celeri", "apio"],
    allergenCode: "celery",
    relation: "contains",
  },

  // ===== LUPIN =====
  {
    name: "lupin",
    aliases: ["lupine", "lupin flour", "lupin beans", "lupini beans", "lupinus"],
    allergenCode: "lupin",
    relation: "contains",
  },

  // ===== SULFITES =====
  {
    name: "sulfites",
    aliases: [
      "sulfite",
      "sulphites",
      "sulphite",
      "sulfur dioxide",
      "sulphur dioxide",
      "sodium sulfite",
      "sodium bisulfite",
      "potassium bisulfite",
    ],
    allergenCode: "sulfite",
    relation: "contains",
  },
];

/**
 * Build a fast lookup map from ingredient name (normalized) to allergen mappings
 */
export function buildIngredientMap(): Map<string, IngredientAllergenMapping[]> {
  const map = new Map<string, IngredientAllergenMapping[]>();

  function addMapping(key: string, mapping: IngredientAllergenMapping) {
    const normalized = normalizeIngredientName(key);
    const existing = map.get(normalized) || [];
    existing.push(mapping);
    map.set(normalized, existing);
  }

  for (const mapping of ingredientAllergenMappings) {
    addMapping(mapping.name, mapping);
    for (const alias of mapping.aliases) {
      addMapping(alias, mapping);
    }
  }

  return map;
}

/**
 * Normalize ingredient name for matching
 * - Lowercase
 * - Trim whitespace
 * - Replace hyphens with spaces
 * - Remove other punctuation
 * - Remove extra spaces
 */
export function normalizeIngredientName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/-/g, " ")
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

type IndexedPhrase = {
  tokens: string[];
  phrase: string;
  mappings: IngredientAllergenMapping[];
};

function mappingIdentity(mapping: IngredientAllergenMapping): string {
  return `${mapping.allergenCode}\0${mapping.relation}\0${mapping.name}`;
}

function dedupeMappings(mappings: IngredientAllergenMapping[]): IngredientAllergenMapping[] {
  const seen = new Set<string>();
  const result: IngredientAllergenMapping[] = [];
  for (const mapping of mappings) {
    const key = mappingIdentity(mapping);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(mapping);
  }
  return result;
}

function indexPhrases(map: Map<string, IngredientAllergenMapping[]>): IndexedPhrase[] {
  const byPhrase = new Map<string, IndexedPhrase>();
  for (const [key, mappings] of map) {
    const tokens = phraseTokens(key);
    if (tokens.length === 0) continue;
    const existing = byPhrase.get(key);
    if (existing) {
      existing.mappings.push(...mappings);
      continue;
    }
    byPhrase.set(key, { tokens, phrase: key, mappings: [...mappings] });
  }
  return [...byPhrase.values()]
    .map((entry) => ({ ...entry, mappings: dedupeMappings(entry.mappings) }))
    .sort((a, b) => {
      if (b.tokens.length !== a.tokens.length) return b.tokens.length - a.tokens.length;
      return b.phrase.length - a.phrase.length;
    });
}

let cachedDefaultMap: Map<string, IngredientAllergenMapping[]> | undefined;
let cachedDefaultPhrases: IndexedPhrase[] | undefined;

function defaultIngredientMap(): Map<string, IngredientAllergenMapping[]> {
  cachedDefaultMap ??= buildIngredientMap();
  return cachedDefaultMap;
}

/**
 * "Almond-free pesto" is a seed or swap pesto, not a pine-nut finding.
 * Still flag explicit pine nuts on the same line.
 */
function skipPestoPineNutHeuristic(line: string, mapping: IngredientAllergenMapping): boolean {
  if (mapping.allergenCode !== "pine_nut") return false;
  const pestoName =
    mapping.name === "pesto" || mapping.aliases.some((alias) => /\bpesto\b/i.test(alias));
  if (!pestoName) return false;
  if (/\bpine\s*nuts?\b/i.test(line)) return false;
  return /\b(almond|cashew|walnut|pecan|hazelnut|pistachio|macadamia|nut)s?-free\b/i.test(line);
}

/**
 * Match an ingredient line to allergen mappings.
 * Exact lookup first, then word-boundary / plural phrase scan on raw text
 * (so "1/2 cup roasted peanuts" matches peanut). Longer phrases win so
 * "coconut milk" is coconut, not dairy milk.
 */
export function matchIngredient(
  ingredientName: string,
  map: Map<string, IngredientAllergenMapping[]> = defaultIngredientMap()
): IngredientAllergenMapping[] {
  const keep = (mappings: IngredientAllergenMapping[]) =>
    dedupeMappings(mappings).filter(
      (mapping) =>
        !lineNegatesAllergen(ingredientName, mapping.allergenCode) &&
        !skipPestoPineNutHeuristic(ingredientName, mapping)
    );

  const exact = map.get(normalizeIngredientName(ingredientName));
  if (exact && exact.length > 0) {
    return keep(exact);
  }

  const phrases =
    map === cachedDefaultMap ? (cachedDefaultPhrases ??= indexPhrases(map)) : indexPhrases(map);
  const haystack = phraseTokens(ingredientName);
  const used = haystack.map(() => false);
  const found: IngredientAllergenMapping[] = [];

  for (const entry of phrases) {
    const starts = findPhraseStarts(entry.phrase, ingredientName);
    for (const start of starts) {
      const alreadyUsed = entry.tokens.some((_, offset) => used[start + offset]);
      if (alreadyUsed) continue;
      for (let offset = 0; offset < entry.tokens.length; offset++) {
        used[start + offset] = true;
      }
      found.push(...entry.mappings);
    }
  }

  return keep(found);
}

registerNegationCompounds(
  ingredientAllergenMappings.flatMap((mapping) => [mapping.name, ...mapping.aliases])
);
