export type Bucket = "cant_have" | "doesnt_eat" | "rather_not";
export type SharedEquipment = "yes" | "ask" | "no";
export type Generation = "adult" | "kid";
export type Mark = "ok" | "warn" | "block";

export type RestrictionOptions = {
  sharedEquipment?: SharedEquipment;
  coconutAsTreeNut?: boolean;
};

export type Restriction = {
  id: string;
  itemId: string;
  bucket: Bucket;
  options: RestrictionOptions;
};

export type Person = {
  id: string;
  name: string;
  emoji: string;
  color: string;
  generation: Generation;
  restrictions: Restriction[];
};

export type Household = {
  name: string;
  people: Person[];
};

export type CatalogItem = {
  id: string;
  label: string;
  avoidLabel?: string;
  emoji: string;
  group: "allergen" | "diet" | "other";
  matchTags: string[];
  featured?: boolean;
  advanced?: Array<"sharedEquipment" | "coconutAsTreeNut">;
};

export type RecipeIngredient = {
  id: string;
  name: string;
  food: string;
  tags: string[];
};

export type RecipeSwap = {
  id: string;
  label: string;
  detail: string;
  ingredientId: string;
  replacementName: string;
  removeTags: string[];
  addTags?: string[];
};

export type Recipe = {
  id: string;
  title: string;
  lede: string;
  emoji: string;
  minutes: number;
  servings: number;
  mayContainNuts: boolean;
  ingredients: RecipeIngredient[];
  steps: string[];
  swaps: RecipeSwap[];
};

export type Finding = {
  personId: string;
  personName: string;
  mark: Mark;
  title: string;
  reason: string;
  ingredientName?: string;
};

export type CookingFor =
  { mode: "everyone" } | { mode: "kids" } | { mode: "custom"; personIds: string[] };

export type HouseholdSummary = {
  line: string;
  avoids: string[];
  severeCount: number;
  badge: string | null;
};

export const AVATAR_COLORS = [
  "#e07a3d",
  "#c46a1b",
  "#c4473a",
  "#2f9e62",
  "#3d8bfd",
  "#7b6cff",
  "#db5a9a",
  "#161310",
] as const;

export const AVATAR_EMOJIS = [
  "🧑‍🍳",
  "👩",
  "👨",
  "👧",
  "👦",
  "👶",
  "🌻",
  "🌟",
  "🦋",
  "⚽️",
  "🏀",
  "🎨",
  "📚",
  "🎵",
  "🌈",
  "🐶",
  "🐱",
  "🦊",
  "🌙",
  "☀️",
  "🔥",
  "🍀",
  "🌸",
  "🍋",
] as const;

export const CATALOG: CatalogItem[] = [
  {
    id: "peanut",
    label: "Peanuts",
    avoidLabel: "peanuts",
    emoji: "🥜",
    group: "allergen",
    matchTags: ["peanut"],
    featured: true,
    advanced: ["sharedEquipment"],
  },
  {
    id: "tree_nut",
    label: "Tree nuts",
    avoidLabel: "tree nuts",
    emoji: "🌰",
    group: "allergen",
    matchTags: ["tree_nut"],
    featured: true,
    advanced: ["sharedEquipment", "coconutAsTreeNut"],
  },
  {
    id: "milk",
    label: "Milk",
    avoidLabel: "dairy",
    emoji: "🥛",
    group: "allergen",
    matchTags: ["dairy", "milk"],
    featured: true,
  },
  {
    id: "egg",
    label: "Eggs",
    emoji: "🥚",
    group: "allergen",
    matchTags: ["egg"],
    featured: true,
  },
  {
    id: "fish",
    label: "Fish",
    emoji: "🐟",
    group: "allergen",
    matchTags: ["fish"],
    featured: true,
  },
  {
    id: "shellfish",
    label: "Shellfish",
    emoji: "🦐",
    group: "allergen",
    matchTags: ["shellfish"],
    featured: true,
  },
  {
    id: "wheat",
    label: "Wheat",
    emoji: "🌾",
    group: "allergen",
    matchTags: ["wheat"],
    featured: true,
  },
  {
    id: "soy",
    label: "Soy",
    emoji: "🫘",
    group: "allergen",
    matchTags: ["soy"],
    featured: true,
  },
  {
    id: "sesame",
    label: "Sesame",
    emoji: "⚪",
    group: "allergen",
    matchTags: ["sesame"],
    featured: true,
  },
  {
    id: "vegetarian",
    label: "Vegetarian",
    emoji: "🥗",
    group: "diet",
    matchTags: ["meat", "poultry", "fish", "shellfish", "gelatin"],
    featured: true,
  },
  {
    id: "vegan",
    label: "Vegan",
    emoji: "🌱",
    group: "diet",
    matchTags: ["meat", "poultry", "fish", "shellfish", "dairy", "milk", "egg", "honey", "gelatin"],
    featured: true,
  },
  {
    id: "gluten_free",
    label: "Gluten-free",
    emoji: "🍞",
    group: "diet",
    matchTags: ["wheat", "gluten", "barley", "rye"],
    featured: true,
  },
  {
    id: "dairy_free",
    label: "Dairy-free",
    avoidLabel: "dairy",
    emoji: "🧀",
    group: "diet",
    matchTags: ["dairy", "milk"],
    featured: true,
  },
  {
    id: "halal",
    label: "Halal",
    emoji: "🌙",
    group: "diet",
    matchTags: ["pork", "alcohol"],
    featured: true,
  },
  {
    id: "kosher",
    label: "Kosher",
    emoji: "✡️",
    group: "diet",
    matchTags: ["pork", "shellfish"],
    featured: true,
  },
  {
    id: "coconut",
    label: "Coconut",
    emoji: "🥥",
    group: "other",
    matchTags: ["coconut"],
  },
  {
    id: "pine_nut",
    label: "Pine nuts",
    emoji: "🌲",
    group: "other",
    matchTags: ["pine_nut", "tree_nut"],
  },
  {
    id: "mushroom",
    label: "Mushrooms",
    emoji: "🍄",
    group: "other",
    matchTags: ["mushroom"],
  },
  {
    id: "garlic",
    label: "Garlic",
    emoji: "🧄",
    group: "other",
    matchTags: ["garlic"],
  },
  {
    id: "onion",
    label: "Onion",
    emoji: "🧅",
    group: "other",
    matchTags: ["onion"],
  },
  {
    id: "cilantro",
    label: "Cilantro",
    emoji: "🌿",
    group: "other",
    matchTags: ["cilantro"],
  },
  {
    id: "pork",
    label: "Pork",
    emoji: "🥓",
    group: "other",
    matchTags: ["pork"],
  },
  {
    id: "spicy",
    label: "Spicy food",
    emoji: "🌶️",
    group: "other",
    matchTags: ["spicy"],
  },
  {
    id: "tomato",
    label: "Tomatoes",
    emoji: "🍅",
    group: "other",
    matchTags: ["tomato"],
  },
  {
    id: "mustard",
    label: "Mustard",
    emoji: "🌭",
    group: "other",
    matchTags: ["mustard"],
  },
  {
    id: "corn",
    label: "Corn",
    emoji: "🌽",
    group: "other",
    matchTags: ["corn"],
  },
];

export const FEATURED_TILES = CATALOG.filter((item) => item.featured);

export const RECIPES: Recipe[] = [
  {
    id: "pesto-pasta",
    title: "Basil pesto pasta",
    lede: "A weeknight pesto with pine nuts, Parmesan, and lots of basil.",
    emoji: "🍝",
    minutes: 25,
    servings: 4,
    mayContainNuts: true,
    ingredients: [
      { id: "linguine", name: "12 oz linguine", food: "linguine", tags: ["wheat", "gluten"] },
      { id: "basil", name: "2 cups fresh basil", food: "basil", tags: [] },
      {
        id: "pine-nuts",
        name: "1/3 cup pine nuts",
        food: "pine nuts",
        tags: ["tree_nut", "pine_nut"],
      },
      { id: "parmesan", name: "1/2 cup Parmesan", food: "Parmesan", tags: ["dairy", "milk"] },
      { id: "olive-oil", name: "1/3 cup olive oil", food: "olive oil", tags: [] },
      { id: "garlic", name: "1 garlic clove", food: "garlic", tags: ["garlic"] },
      { id: "salt", name: "Kosher salt", food: "salt", tags: [] },
    ],
    steps: [
      "Toast the pine nuts until just golden.",
      "Blend basil, pine nuts, Parmesan, garlic, and oil into a pesto.",
      "Boil the linguine and toss with the pesto.",
    ],
    swaps: [
      {
        id: "sunflower",
        label: "Swap pine nuts for sunflower seeds",
        detail: "Same toasty crunch, no tree nuts.",
        ingredientId: "pine-nuts",
        replacementName: "1/3 cup sunflower seeds",
        removeTags: ["tree_nut", "pine_nut"],
      },
      {
        id: "no-parmesan",
        label: "Skip the Parmesan",
        detail: "Use extra basil, lemon, and salt instead.",
        ingredientId: "parmesan",
        replacementName: "Lemon zest and extra basil (no Parmesan)",
        removeTags: ["dairy", "milk"],
      },
    ],
  },
  {
    id: "peanut-noodles",
    title: "Peanut satay noodles",
    lede: "Cold rice noodles with a creamy peanut sauce.",
    emoji: "🍜",
    minutes: 20,
    servings: 4,
    mayContainNuts: true,
    ingredients: [
      { id: "rice-noodles", name: "8 oz rice noodles", food: "rice noodles", tags: [] },
      {
        id: "peanut-butter",
        name: "1/3 cup peanut butter",
        food: "peanut butter",
        tags: ["peanut"],
      },
      { id: "soy-sauce", name: "2 tbsp soy sauce", food: "soy sauce", tags: ["soy"] },
      { id: "lime", name: "1 lime", food: "lime", tags: [] },
    ],
    steps: ["Whisk the sauce.", "Toss with noodles."],
    swaps: [
      {
        id: "tahini",
        label: "Swap peanut sauce for tahini",
        detail: "Still creamy, now sesame-based.",
        ingredientId: "peanut-butter",
        replacementName: "1/3 cup tahini",
        removeTags: ["peanut"],
        addTags: ["sesame"],
      },
    ],
  },
  {
    id: "tomato-spaghetti",
    title: "Tomato basil spaghetti",
    lede: "Pantry tomatoes, garlic, and a handful of basil.",
    emoji: "🍅",
    minutes: 30,
    servings: 4,
    mayContainNuts: false,
    ingredients: [
      { id: "spaghetti", name: "12 oz spaghetti", food: "spaghetti", tags: ["wheat", "gluten"] },
      { id: "tomato", name: "1 can crushed tomatoes", food: "tomatoes", tags: ["tomato"] },
      { id: "basil", name: "Fresh basil", food: "basil", tags: [] },
      { id: "garlic", name: "3 garlic cloves", food: "garlic", tags: ["garlic"] },
      { id: "olive-oil", name: "Olive oil", food: "olive oil", tags: [] },
    ],
    steps: ["Simmer the sauce.", "Boil pasta and combine."],
    swaps: [],
  },
  {
    id: "grilled-cheese",
    title: "Grilled cheese",
    lede: "Crisp bread, melted cheddar — the kids' emergency dinner.",
    emoji: "🥪",
    minutes: 10,
    servings: 2,
    mayContainNuts: false,
    ingredients: [
      { id: "bread", name: "4 slices sandwich bread", food: "bread", tags: ["wheat", "gluten"] },
      { id: "cheddar", name: "4 oz cheddar", food: "cheddar", tags: ["dairy", "milk"] },
      { id: "butter", name: "Butter", food: "butter", tags: ["dairy", "milk"] },
    ],
    steps: ["Butter the bread.", "Grill until the cheddar melts."],
    swaps: [],
  },
  {
    id: "chicken-rice",
    title: "Chicken rice bowls",
    lede: "Roasted chicken, rice, and broccoli. Quietly reliable.",
    emoji: "🍗",
    minutes: 35,
    servings: 4,
    mayContainNuts: false,
    ingredients: [
      { id: "chicken", name: "1.5 lb chicken thighs", food: "chicken", tags: ["meat", "poultry"] },
      { id: "rice", name: "2 cups cooked rice", food: "rice", tags: [] },
      { id: "broccoli", name: "1 head broccoli", food: "broccoli", tags: [] },
      { id: "olive-oil", name: "Olive oil", food: "olive oil", tags: [] },
    ],
    steps: ["Roast the chicken and broccoli.", "Serve over rice."],
    swaps: [],
  },
  {
    id: "hummus-plate",
    title: "Hummus plate",
    lede: "Chickpeas, tahini, cucumbers, and warm pita.",
    emoji: "🫓",
    minutes: 15,
    servings: 4,
    mayContainNuts: false,
    ingredients: [
      { id: "chickpeas", name: "1 can chickpeas", food: "chickpeas", tags: [] },
      { id: "tahini", name: "3 tbsp tahini", food: "tahini", tags: ["sesame"] },
      { id: "pita", name: "Warm pita", food: "pita", tags: ["wheat", "gluten"] },
      { id: "cucumber", name: "Cucumber", food: "cucumber", tags: [] },
    ],
    steps: ["Blend the hummus.", "Plate with pita and cucumber."],
    swaps: [],
  },
  {
    id: "mushroom-risotto",
    title: "Mushroom risotto",
    lede: "Creamy rice with browned mushrooms and Parmesan.",
    emoji: "🍄",
    minutes: 40,
    servings: 4,
    mayContainNuts: false,
    ingredients: [
      { id: "rice", name: "1.5 cups arborio rice", food: "rice", tags: [] },
      { id: "mushrooms", name: "12 oz mixed mushrooms", food: "mushrooms", tags: ["mushroom"] },
      { id: "parmesan", name: "1/2 cup Parmesan", food: "Parmesan", tags: ["dairy", "milk"] },
      { id: "butter", name: "2 tbsp butter", food: "butter", tags: ["dairy", "milk"] },
    ],
    steps: ["Brown the mushrooms.", "Stir the risotto until creamy."],
    swaps: [],
  },
  {
    id: "yogurt-berries",
    title: "Yogurt and berries",
    lede: "Breakfast or a late snack. Honey if you want it.",
    emoji: "🍓",
    minutes: 5,
    servings: 2,
    mayContainNuts: false,
    ingredients: [
      { id: "yogurt", name: "2 cups yogurt", food: "yogurt", tags: ["dairy", "milk"] },
      { id: "berries", name: "1 cup berries", food: "berries", tags: [] },
      { id: "honey", name: "Honey", food: "honey", tags: ["honey"] },
    ],
    steps: ["Spoon yogurt into bowls.", "Top with berries."],
    swaps: [],
  },
];

export const DEMO_HOUSEHOLD: Household = {
  name: "Your kitchen",
  people: [
    {
      id: "ty",
      name: "Ty",
      emoji: "🧑‍🍳",
      color: "#e07a3d",
      generation: "adult",
      restrictions: [],
    },
    {
      id: "bec",
      name: "Bec",
      emoji: "🌻",
      color: "#c46a1b",
      generation: "adult",
      restrictions: [
        {
          id: "r-bec-dairy",
          itemId: "dairy_free",
          bucket: "doesnt_eat",
          options: {},
        },
      ],
    },
    {
      id: "ellie",
      name: "Ellie",
      emoji: "🌟",
      color: "#3d8bfd",
      generation: "kid",
      restrictions: [
        {
          id: "r-ellie-mushroom",
          itemId: "mushroom",
          bucket: "rather_not",
          options: {},
        },
      ],
    },
    {
      id: "laynie",
      name: "Laynie",
      emoji: "🦋",
      color: "#7b6cff",
      generation: "kid",
      restrictions: [],
    },
    {
      id: "jake",
      name: "Jake",
      emoji: "⚽️",
      color: "#2f9e62",
      generation: "kid",
      restrictions: [
        {
          id: "r-jake-peanut",
          itemId: "peanut",
          bucket: "cant_have",
          options: { sharedEquipment: "yes" },
        },
        {
          id: "r-jake-tree-nut",
          itemId: "tree_nut",
          bucket: "cant_have",
          options: { sharedEquipment: "yes", coconutAsTreeNut: false },
        },
      ],
    },
  ],
};

export const STORAGE_KEY = "ovenlovin.prototype.people.v1";

export function newId(prefix: string): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

export function catalogById(id: string): CatalogItem | undefined {
  return CATALOG.find((item) => item.id === id);
}

export function recipeById(id: string): Recipe | undefined {
  return RECIPES.find((recipe) => recipe.id === id);
}

export function searchCatalog(query: string): CatalogItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return FEATURED_TILES;
  return CATALOG.filter(
    (item) =>
      item.label.toLowerCase().includes(q) ||
      item.id.includes(q) ||
      item.matchTags.some((tag) => tag.includes(q))
  );
}

export function restrictionLabel(restriction: Restriction): string {
  return catalogById(restriction.itemId)?.label ?? restriction.itemId;
}

export function restrictionEmoji(restriction: Restriction): string {
  return catalogById(restriction.itemId)?.emoji ?? "•";
}

export function bucketLabel(bucket: Bucket): string {
  if (bucket === "cant_have") return "Can't have";
  if (bucket === "doesnt_eat") return "Doesn't eat";
  return "Would rather not";
}

export function bucketHint(bucket: Bucket): string {
  if (bucket === "cant_have") return "Allergy — treat as unsafe";
  if (bucket === "doesnt_eat") return "Diet or hard no";
  return "Preference — warn, don't block";
}

export function formatList(items: string[]): string {
  if (items.length === 0) return "";
  const first = items[0];
  if (items.length === 1) return first ?? "";
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
}

export function summarizeHousehold(household: Household): HouseholdSummary {
  if (household.people.length === 0) {
    return {
      line: "Add the people you cook for.",
      avoids: [],
      severeCount: 0,
      badge: null,
    };
  }

  const ranked: Array<{ label: string; rank: number }> = [];
  const seen = new Set<string>();
  for (const person of household.people) {
    for (const restriction of person.restrictions) {
      if (restriction.bucket === "rather_not") continue;
      const item = catalogById(restriction.itemId);
      const label = (item?.avoidLabel ?? item?.label ?? restriction.itemId).toLowerCase();
      if (seen.has(label)) continue;
      seen.add(label);
      ranked.push({
        label,
        rank: item ? CATALOG.indexOf(item) : 999,
      });
    }
  }
  const avoids = ranked.sort((a, b) => a.rank - b.rank).map((item) => item.label);

  const severeCount = household.people.filter((person) =>
    person.restrictions.some((restriction) => {
      const item = catalogById(restriction.itemId);
      return restriction.bucket === "cant_have" && item?.group === "allergen";
    })
  ).length;

  if (avoids.length === 0) {
    const prefers = household.people.some((person) =>
      person.restrictions.some((restriction) => restriction.bucket === "rather_not")
    );
    return {
      line: prefers
        ? "Mostly easygoing, with a few preferences."
        : "Everyone here can eat everything — for now.",
      avoids,
      severeCount,
      badge: null,
    };
  }

  return {
    line: `Avoids ${formatList(avoids)}`,
    avoids,
    severeCount,
    badge:
      severeCount === 0
        ? null
        : `${severeCount} severe ${severeCount === 1 ? "allergy" : "allergies"}`,
  };
}

export function cookingForPeople(household: Household, cookingFor: CookingFor): Person[] {
  if (cookingFor.mode === "everyone") return household.people;
  if (cookingFor.mode === "kids") {
    return household.people.filter((person) => person.generation === "kid");
  }
  const allowed = new Set(cookingFor.personIds);
  return household.people.filter((person) => allowed.has(person.id));
}

export function applySwaps(recipe: Recipe, swapIds: string[]): Recipe {
  const selected = new Set(swapIds);
  const swaps = recipe.swaps.filter((swap) => selected.has(swap.id));
  if (swaps.length === 0) return recipe;

  const ingredients = recipe.ingredients.map((ingredient) => {
    const swap = swaps.find((item) => item.ingredientId === ingredient.id);
    if (!swap) return ingredient;
    const tags = ingredient.tags.filter((tag) => !swap.removeTags.includes(tag));
    return {
      ...ingredient,
      name: swap.replacementName,
      tags: [...tags, ...(swap.addTags ?? [])],
    };
  });

  const stillHasNuts = ingredients.some(
    (ingredient) => ingredient.tags.includes("tree_nut") || ingredient.tags.includes("peanut")
  );

  return {
    ...recipe,
    ingredients,
    mayContainNuts: recipe.mayContainNuts && (stillHasNuts || swaps.some((swap) => swap.id)),
  };
}

function matchTagsFor(restriction: Restriction): string[] {
  const item = catalogById(restriction.itemId);
  const tags = [...(item?.matchTags ?? [restriction.itemId])];
  if (
    restriction.options.coconutAsTreeNut &&
    (item?.id === "tree_nut" || tags.includes("tree_nut"))
  ) {
    tags.push("coconut");
  }
  return tags;
}

function worstMark(marks: Mark[]): Mark {
  if (marks.includes("block")) return "block";
  if (marks.includes("warn")) return "warn";
  return "ok";
}

export function checkPerson(person: Person, recipe: Recipe): Finding {
  if (person.restrictions.length === 0) {
    return {
      personId: person.id,
      personName: person.name,
      mark: "ok",
      title: `${person.name} can eat this`,
      reason: `Nothing in this recipe matches ${person.name}'s rules.`,
    };
  }

  const hits: Array<{ mark: Mark; reason: string; ingredientName?: string }> = [];
  const stillHasDeclaredNuts = recipe.ingredients.some(
    (item) =>
      item.tags.includes("peanut") ||
      item.tags.includes("tree_nut") ||
      item.tags.includes("pine_nut")
  );
  let facilityNoted = false;

  for (const restriction of person.restrictions) {
    const tags = matchTagsFor(restriction);
    const ingredient = recipe.ingredients.find((item) =>
      item.tags.some((tag) => tags.includes(tag))
    );
    const label = restrictionLabel(restriction).toLowerCase();
    const countsAs = restriction.itemId === "tree_nut" ? "a tree nut" : label;

    if (ingredient) {
      const mark: Mark = restriction.bucket === "rather_not" ? "warn" : "block";
      if (restriction.bucket === "cant_have") {
        hits.push({
          mark,
          ingredientName: ingredient.food,
          reason: `Contains ${ingredient.food.toLowerCase()}, which counts as ${countsAs} for ${person.name}.`,
        });
      } else if (restriction.bucket === "doesnt_eat") {
        hits.push({
          mark,
          ingredientName: ingredient.food,
          reason: `Contains ${ingredient.food.toLowerCase()}, and ${person.name} doesn't eat ${label}.`,
        });
      } else {
        hits.push({
          mark,
          ingredientName: ingredient.food,
          reason: `${person.name} would rather not eat ${label} — this recipe has ${ingredient.food.toLowerCase()}.`,
        });
      }
      continue;
    }

    const nutRule =
      restriction.itemId === "peanut" ||
      restriction.itemId === "tree_nut" ||
      restriction.itemId === "pine_nut";
    if (facilityNoted) continue;
    if (
      nutRule &&
      recipe.mayContainNuts &&
      !stillHasDeclaredNuts &&
      restriction.options.sharedEquipment === "yes"
    ) {
      facilityNoted = true;
      hits.push({
        mark: "warn",
        reason: `The nuts are out, but this may be made where nuts are processed — and ${person.name} avoids that.`,
      });
    } else if (
      nutRule &&
      recipe.mayContainNuts &&
      !stillHasDeclaredNuts &&
      restriction.options.sharedEquipment === "ask"
    ) {
      facilityNoted = true;
      hits.push({
        mark: "warn",
        reason: `Ask before serving ${person.name} — this may be made where nuts are processed.`,
      });
    }
  }

  if (hits.length === 0) {
    return {
      personId: person.id,
      personName: person.name,
      mark: "ok",
      title: `${person.name} can eat this`,
      reason: `Nothing in this recipe matches ${person.name}'s rules.`,
    };
  }

  const mark = worstMark(hits.map((hit) => hit.mark));
  const primary = hits.find((hit) => hit.mark === mark) ?? hits[0];
  const extra = hits.filter((hit) => hit !== primary).map((hit) => hit.reason);

  let title = `${person.name} can eat this`;
  if (mark === "block") title = `${person.name} can't eat this`;
  if (mark === "warn") title = `Check with ${person.name} first`;

  return {
    personId: person.id,
    personName: person.name,
    mark,
    title,
    reason: [primary?.reason, ...extra].filter(Boolean).join(" "),
    ingredientName: primary?.ingredientName,
  };
}

export function checkRecipe(
  household: Household,
  recipe: Recipe,
  swapIds: string[],
  cookingFor: CookingFor
): Finding[] {
  const prepared = applySwaps(recipe, swapIds);
  return cookingForPeople(household, cookingFor).map((person) => checkPerson(person, prepared));
}

export function slugPersonName(name: string): string {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return slug || newId("p");
}

export function defaultBucketForItem(item: CatalogItem): Bucket {
  if (item.group === "allergen") return "cant_have";
  if (item.group === "diet") return "doesnt_eat";
  return "rather_not";
}

export function defaultOptionsForItem(item: CatalogItem): RestrictionOptions {
  if (item.id === "tree_nut" || item.id === "peanut") {
    return { sharedEquipment: "ask", coconutAsTreeNut: false };
  }
  return {};
}

export function hexToRgba(hex: string, alpha: number): string {
  const raw = hex.replace("#", "");
  const full =
    raw.length === 3
      ? raw
          .split("")
          .map((part) => part + part)
          .join("")
      : raw;
  const int = Number.parseInt(full, 16);
  if (Number.isNaN(int)) return `rgba(224, 122, 61, ${alpha})`;
  const r = (int >> 16) & 255;
  const g = (int >> 8) & 255;
  const b = int & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function personTheme(color: string): { wash: string; glow: string; ink: string } {
  return {
    wash: hexToRgba(color, 0.2),
    glow: hexToRgba(color, 0.38),
    ink: color,
  };
}

export function severePeople(household: Household): Person[] {
  return household.people.filter((person) =>
    person.restrictions.some((restriction) => {
      const item = catalogById(restriction.itemId);
      return restriction.bucket === "cant_have" && item?.group === "allergen";
    })
  );
}

export function safeToCookLine(summary: HouseholdSummary): string {
  if (summary.avoids.length === 0) return summary.line;
  return `Tonight is clear if we skip ${formatList(summary.avoids)}.`;
}
