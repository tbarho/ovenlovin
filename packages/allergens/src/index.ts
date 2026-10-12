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
