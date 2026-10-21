import { normalizeIngredientName } from "../parsing/ingredient-line";

/** Food taxonomy for `groupBy=category` - not grocery-store aisles. */
export const SHOPPING_LIST_CATEGORIES = [
  "produce",
  "protein",
  "dairy",
  "grains",
  "spices",
  "pantry",
  "frozen",
  "other",
] as const;

export type ShoppingListCategory = (typeof SHOPPING_LIST_CATEGORIES)[number];

export type AisleAssignment = {
  aisle: string;
  category: ShoppingListCategory;
  canonicalName: string;
};

type AisleRule = {
  aliases: string[];
  aisle: string;
  category: ShoppingListCategory;
  canonical?: string;
};

const PANTRY_STAPLES = {
  aliases: [
    "salt",
    "kosher salt",
    "sea salt",
    "table salt",
    "iodized salt",
    "coarse salt",
    "fine salt",
    "black pepper",
    "white pepper",
    "ground pepper",
    "pepper",
    "olive oil",
    "extra virgin olive oil",
    "extra-virgin olive oil",
    "vegetable oil",
    "canola oil",
    "sesame oil",
    "avocado oil",
    "coconut oil",
    "cooking oil",
    "cooking spray",
    "oil",
    "water",
  ],
  except: ["bell pepper", "bell peppers"],
};

const PANTRY_STAPLE_ALIASES = new Set(
  PANTRY_STAPLES.aliases.map((alias) => normalizeIngredientName(alias))
);
const PANTRY_STAPLE_EXCEPTIONS = new Set(
  PANTRY_STAPLES.except.map((alias) => normalizeIngredientName(alias))
);

/**
 * Longer aliases are matched first so "kosher salt" / "bell pepper" /
 * "rice vinegar" win over "salt" / "pepper" / "rice".
 */
const AISLE_RULES: AisleRule[] = [
  {
    aliases: [
      "frozen peas and carrots",
      "peas and carrots",
      "frozen peas",
      "frozen corn",
      "frozen spinach",
      "frozen berries",
      "frozen broccoli",
      "ice cream",
    ],
    aisle: "Frozen",
    category: "frozen",
  },
  {
    aliases: [
      "extra virgin olive oil",
      "extra-virgin olive oil",
      "olive oil",
      "vegetable oil",
      "canola oil",
      "sesame oil",
      "avocado oil",
      "coconut oil",
      "cooking oil",
      "rice vinegar",
      "apple cider vinegar",
      "balsamic vinegar",
      "white vinegar",
      "vinegar",
      "oil",
    ],
    aisle: "Oils & vinegar",
    category: "pantry",
  },
  {
    aliases: [
      "kosher salt",
      "sea salt",
      "table salt",
      "iodized salt",
      "coarse salt",
      "fine salt",
      "salt",
    ],
    aisle: "Spices",
    category: "spices",
    canonical: "salt",
  },
  {
    aliases: [
      "black pepper",
      "white pepper",
      "ground pepper",
      "chili powder",
      "garlic powder",
      "onion powder",
      "chile flakes",
      "red pepper flakes",
      "dried oregano",
      "dried thyme",
      "paprika",
      "cumin",
      "cinnamon",
      "oregano",
      "turmeric",
      "nutmeg",
      "cayenne",
      "pepper",
    ],
    aisle: "Spices",
    category: "spices",
  },
  {
    aliases: [
      "all-purpose flour",
      "all purpose flour",
      "bread flour",
      "brown sugar",
      "powdered sugar",
      "baking soda",
      "baking powder",
      "chocolate chips",
      "vanilla extract",
      "vanilla",
      "flour",
      "sugar",
      "cocoa",
    ],
    aisle: "Baking",
    category: "pantry",
  },
  {
    aliases: [
      "crushed tomatoes",
      "diced tomatoes",
      "tomato sauce",
      "tomato paste",
      "black beans",
      "kidney beans",
      "chickpeas",
      "garbanzo beans",
      "canned beans",
      "kalamata olives",
      "black olives",
      "green olives",
      "olives",
      "olive",
      "beans",
    ],
    aisle: "Canned goods",
    category: "pantry",
  },
  {
    aliases: [
      "bell pepper",
      "bell peppers",
      "sweet potato",
      "sweet potatoes",
      "green onion",
      "green onions",
      "brussels sprout",
      "brussels sprouts",
      "cherry tomato",
      "cherry tomatoes",
      "acorn squash",
      "butternut squash",
      "baby carrot",
      "baby carrots",
      "carrot",
      "carrots",
      "shallot",
      "leek",
      "scallion",
      "celery",
      "lettuce",
      "spinach",
      "kale",
      "arugula",
      "chard",
      "collard",
      "cabbage",
      "broccoli",
      "cauliflower",
      "zucchini",
      "squash",
      "cucumber",
      "tomato",
      "tomatoes",
      "potato",
      "potatoes",
      "yam",
      "pepper",
      "peppers",
      "jalapeno",
      "jalapeño",
      "avocado",
      "lemon",
      "lime",
      "apple",
      "apples",
      "banana",
      "bananas",
      "strawberry",
      "blueberry",
      "grape",
      "orange",
      "mango",
      "pineapple",
      "watermelon",
      "peach",
      "pear",
      "plum",
      "cherry",
      "cilantro",
      "parsley",
      "basil",
      "mint",
      "dill",
      "rosemary",
      "thyme",
      "ginger",
      "radish",
      "beet",
      "turnip",
      "parsnip",
      "asparagus",
      "green bean",
      "pea",
      "peas",
      "corn",
      "mushroom",
      "eggplant",
      "okra",
      "artichoke",
      "fennel",
      "pumpkin",
    ],
    aisle: "Produce",
    category: "produce",
  },
  {
    aliases: [
      "yellow onion",
      "white onion",
      "red onion",
      "sweet onion",
      "large onion",
      "onion",
      "onions",
    ],
    aisle: "Produce",
    category: "produce",
    canonical: "onion",
  },
  {
    aliases: ["minced garlic", "garlic cloves", "garlic clove", "garlic"],
    aisle: "Produce",
    category: "produce",
    canonical: "garlic",
  },
  {
    aliases: [
      "sour cream",
      "cottage cheese",
      "cream cheese",
      "half and half",
      "heavy cream",
      "mozzarella",
      "parmesan",
      "cheddar",
      "feta",
      "ricotta",
      "buttermilk",
      "yogurt",
      "butter",
      "ghee",
      "milk",
      "cream",
      "cheese",
    ],
    aisle: "Dairy",
    category: "dairy",
  },
  {
    aliases: ["egg", "eggs"],
    aisle: "Dairy",
    category: "protein",
  },
  {
    aliases: [
      "chicken breast",
      "chicken breasts",
      "chicken thigh",
      "chicken thighs",
      "ground beef",
      "ground turkey",
      "chicken",
      "beef",
      "pork",
      "turkey",
      "lamb",
      "bacon",
      "sausage",
      "ham",
      "steak",
      "ribs",
    ],
    aisle: "Meat",
    category: "protein",
  },
  {
    aliases: ["shrimp", "tuna", "cod", "tilapia", "scallop", "crab", "fish"],
    aisle: "Seafood",
    category: "protein",
  },
  {
    aliases: ["salmon fillet", "salmon fillets", "salmon"],
    aisle: "Seafood",
    category: "protein",
    canonical: "salmon",
  },
  {
    aliases: ["tofu", "tempeh", "seitan", "extra-firm tofu", "firm tofu", "silken tofu"],
    aisle: "Refrigerated",
    category: "protein",
  },
  {
    aliases: [
      "rolled oats",
      "corn tortilla",
      "corn tortillas",
      "flour tortilla",
      "pita",
      "pasta",
      "ziti",
      "spaghetti",
      "rice",
      "bread",
      "tortilla",
      "tortillas",
      "noodle",
      "noodles",
      "oats",
      "quinoa",
      "couscous",
    ],
    aisle: "Grains",
    category: "grains",
  },
  {
    aliases: [
      "soy sauce",
      "hot sauce",
      "fish sauce",
      "worcestershire",
      "mustard",
      "ketchup",
      "mayonnaise",
      "mayo",
      "pesto",
      "hummus",
      "peanut butter",
      "tahini",
    ],
    aisle: "Condiments",
    category: "pantry",
  },
  {
    aliases: [
      "vegetable broth",
      "chicken broth",
      "beef broth",
      "vegetable stock",
      "chicken stock",
      "beef stock",
      "coconut milk",
      "maple syrup",
      "peanut",
      "peanuts",
      "broth",
      "stock",
      "honey",
      "lentils",
    ],
    aisle: "Pantry",
    category: "pantry",
  },
];

const CATEGORY_LABELS: Record<ShoppingListCategory, string> = {
  produce: "Produce",
  protein: "Protein",
  dairy: "Dairy",
  grains: "Grains",
  spices: "Spices",
  pantry: "Pantry",
  frozen: "Frozen",
  other: "Other",
};

type CompiledAlias = {
  alias: string;
  pattern: RegExp;
  aisle: string;
  category: ShoppingListCategory;
  canonical?: string;
};

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const COMPILED_ALIASES: CompiledAlias[] = AISLE_RULES.flatMap((rule) => {
  const normalizedAliases = rule.aliases.map((alias) => normalizeIngredientName(alias));
  return rule.aliases.flatMap((alias) => {
    const normalized = normalizeIngredientName(alias);
    const singular =
      normalized.endsWith("s") && !normalized.endsWith("ss") ? normalized.slice(0, -1) : null;
    if (singular && normalizedAliases.includes(singular)) return [];
    const pluralSuffix = normalized.endsWith("s") ? "" : "s?";
    return [
      {
        alias: normalized,
        pattern: new RegExp(`(?:^| )${escapeRegExp(normalized)}${pluralSuffix}(?: |$)`),
        aisle: rule.aisle,
        category: rule.category,
        canonical: rule.canonical,
      },
    ];
  });
}).sort((a, b) => b.alias.length - a.alias.length);

function findRule(name: string): CompiledAlias | undefined {
  const normalized = normalizeIngredientName(name);
  if (!normalized) return undefined;
  return COMPILED_ALIASES.find(
    (rule) =>
      normalized === rule.alias || normalized === `${rule.alias}s` || rule.pattern.test(normalized)
  );
}

export function isPantryStaple(name: string): boolean {
  const normalized = normalizeIngredientName(name);
  if (
    PANTRY_STAPLE_EXCEPTIONS.has(normalized) ||
    [...PANTRY_STAPLE_EXCEPTIONS].some((alias) => {
      const pattern = new RegExp(`(?:^| )${escapeRegExp(alias)}s?(?: |$)`);
      return pattern.test(normalized);
    })
  ) {
    return false;
  }
  if (PANTRY_STAPLE_ALIASES.has(normalized)) return true;
  return [...PANTRY_STAPLE_ALIASES].some((alias) => {
    const pattern = new RegExp(`(?:^| )${escapeRegExp(alias)}s?(?: |$)`);
    return pattern.test(normalized);
  });
}

function canonicalNameFor(name: string, match: CompiledAlias): string {
  if (match.canonical) return match.canonical;
  const normalized = normalizeIngredientName(name);
  if (normalized === match.alias || normalized === `${match.alias}s`) return match.alias;
  return name;
}

export function assignAisle(name: string): AisleAssignment {
  const match = findRule(name);
  if (!match) {
    return { aisle: "Other", category: "other", canonicalName: name };
  }
  return {
    aisle: match.aisle,
    category: match.category,
    canonicalName: canonicalNameFor(name, match),
  };
}

/** Merge key for the shopping list: "lemons" and "lemon" share "lemon". */
export function canonicalShopName(name: string): string {
  return assignAisle(name).canonicalName;
}

export function canonicalIngredientName(name: string): string {
  return canonicalShopName(name);
}

export function categorySectionName(category: ShoppingListCategory): string {
  return CATEGORY_LABELS[category];
}
