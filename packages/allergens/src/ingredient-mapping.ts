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
      // OCR / misspellings
      "hazelnu t",
      "hazeInut",
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
    aliases: ["hickory nuts", "hickory"],
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
    name: "butternut",
    aliases: ["butternuts", "white walnut"],
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
      "coco",
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
    name: "energy bar",
    aliases: ["protein bar", "nutrition bar"],
    allergenCode: "tree_nut",
    relation: "commonly_cross_contact",
    notes: "Often produced in facilities with nuts",
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
    aliases: ["salted butter", "unsalted butter", "clarified butter", "ghee"],
    allergenCode: "milk",
    relation: "contains",
  },
  {
    name: "cheese",
    aliases: ["cheddar", "mozzarella", "parmesan", "swiss", "fromage", "queso", "käse"],
    allergenCode: "milk",
    relation: "contains",
  },
  {
    name: "yogurt",
    aliases: ["yoghurt", "yogourt", "greek yogurt"],
    allergenCode: "milk",
    relation: "contains",
  },

  // ===== EGG =====
  {
    name: "egg",
    aliases: ["eggs", "chicken egg", "whole egg", "egg white", "egg yolk", "oeuf", "huevo"],
    allergenCode: "egg",
    relation: "contains",
  },
  {
    name: "mayonnaise",
    aliases: ["mayo"],
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
      "bread flour",
      "durum",
      "semolina",
      "spelt",
      "farro",
      "kamut",
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
    aliases: ["prawns", "prawn", "crevette", "gamba"],
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

  // ===== FISH =====
  {
    name: "fish",
    aliases: ["salmon", "tuna", "cod", "halibut", "bass", "trout", "poisson", "pescado"],
    allergenCode: "fish",
    relation: "contains",
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

/**
 * Match an ingredient name to allergen mappings
 * Returns all matching mappings
 */
export function matchIngredient(
  ingredientName: string,
  map: Map<string, IngredientAllergenMapping[]> = buildIngredientMap()
): IngredientAllergenMapping[] {
  const normalized = normalizeIngredientName(ingredientName);
  return map.get(normalized) || [];
}
