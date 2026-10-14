import type { IngredientCategory } from "../schemas/ingredients";

export type AisleAssignment = {
  aisle: string;
  category: IngredientCategory;
};

const PANTRY_STAPLE_PATTERN =
  /\b(kosher salt|sea salt|table salt|black pepper|white pepper|olive oil|vegetable oil|canola oil|sesame oil|avocado oil|coconut oil|cooking oil|cooking spray|\bsalt\b|\bpepper\b|\boil\b|\bwater\b)\b/i;

/** First matching rule wins; keep specific phrases ahead of broad ones. */
const AISLE_RULES: Array<{ aisle: string; category: IngredientCategory; pattern: RegExp }> = [
  {
    aisle: "Oils & vinegar",
    category: "pantry",
    pattern:
      /\b(olive oil|vegetable oil|canola oil|sesame oil|avocado oil|coconut oil|cooking oil|\boil\b|vinegar|rice vinegar)\b/i,
  },
  {
    aisle: "Spices",
    category: "spices",
    pattern:
      /\b(kosher salt|sea salt|table salt|\bsalt\b|black pepper|white pepper|oregano|chili powder|paprika|cumin|cinnamon|garlic powder|onion powder|dried chiles?|chile flakes)\b/i,
  },
  {
    aisle: "Baking",
    category: "baking",
    pattern:
      /\b(all-?purpose flour|\bflour\b|brown sugar|\bsugar\b|baking soda|baking powder|chocolate chips|rolled oats|\boats\b|vanilla)\b/i,
  },
  {
    aisle: "Canned goods",
    category: "canned",
    pattern:
      /\b(crushed tomatoes|diced tomatoes|black beans|kidney beans|\bbeans\b|canned|tomato sauce)\b/i,
  },
  { aisle: "Frozen", category: "frozen", pattern: /\b(frozen|peas and carrots)\b/i },
  {
    aisle: "Produce",
    category: "produce",
    pattern:
      /\b(onion|garlic|tomato|tomatoes|lemon|lime|carrot|potato|potatoes|cabbage|broccoli|squash|cucumber|apple|banana|olive|olives|lettuce|bell pepper|peppers|\bpepper\b|cilantro|basil|avocado|spinach)\b/i,
  },
  {
    aisle: "Dairy",
    category: "dairy",
    pattern:
      /\b(milk|butter|cream|buttermilk|sour cream|mozzarella|parmesan|cheddar|feta|cheese|yogurt|egg|eggs)\b/i,
  },
  {
    aisle: "Meat",
    category: "meat",
    pattern: /\b(chicken|beef|pork|bacon|sausage|turkey|thighs|breasts)\b/i,
  },
  { aisle: "Seafood", category: "seafood", pattern: /\b(salmon|shrimp|fish|crab|cod|tuna)\b/i },
  {
    aisle: "Grains",
    category: "grains",
    pattern: /\b(pasta|ziti|rice|bread|tortilla|tortillas|pita|oats|noodle|noodles)\b/i,
  },
  {
    aisle: "Condiments",
    category: "condiments",
    pattern: /\b(soy sauce|pesto|hot sauce|mustard|ketchup|mayo|mayonnaise|hummus)\b/i,
  },
  {
    aisle: "Pantry",
    category: "pantry",
    pattern: /\b(peanut|peanuts|broth|stock|tofu|chocolate)\b/i,
  },
];

const CATEGORY_LABELS: Record<IngredientCategory, string> = {
  produce: "Produce",
  dairy: "Dairy",
  meat: "Meat",
  seafood: "Seafood",
  grains: "Grains",
  pantry: "Pantry",
  spices: "Spices",
  baking: "Baking",
  frozen: "Frozen",
  canned: "Canned goods",
  condiments: "Condiments",
  beverages: "Beverages",
  other: "Other",
};

export function isPantryStaple(name: string): boolean {
  return PANTRY_STAPLE_PATTERN.test(name);
}

export function assignAisle(name: string): AisleAssignment {
  for (const rule of AISLE_RULES) {
    if (rule.pattern.test(name)) {
      return { aisle: rule.aisle, category: rule.category };
    }
  }
  return { aisle: "Other", category: "other" };
}

export function categorySectionName(category: IngredientCategory): string {
  return CATEGORY_LABELS[category];
}
