export {
  allergenTaxonomy,
  buildAllergenMap,
  getDescendants,
  getAncestors,
  type AllergenTaxonomyNode,
} from "./taxonomy";

export {
  ingredientAllergenMappings,
  buildIngredientMap,
  normalizeIngredientName,
  matchIngredient,
  type IngredientAllergenMapping,
} from "./ingredient-mapping";

export {
  checkIngredientAgainstRule,
  checkIngredientsAgainstRules,
  type RuleCheckContext,
  type IngredientCheckInput,
  type RuleCheckFinding,
  type RuleCheckResult,
} from "./rule-checker";

export {
  checkMealPlan,
  type MealPlanCheckInput,
  type MealPlanEntryInput,
  type PersonWithRules,
  type EntryCheckResult,
  type PersonCheckResult,
  type MealPlanCheckResult,
} from "./meal-plan-checker";
