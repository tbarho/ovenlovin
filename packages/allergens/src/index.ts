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

export {
  dietCatalog,
  dislikeCatalog,
  loveCatalog,
  allergenCatalog,
  dietCatalogEntries,
  catalogForIntent,
  allCatalogEntries,
  findCatalogEntry,
  matchPhrasesForTarget,
  searchCatalog,
  humanizeTarget,
  displayNameForTarget,
  normalizeSearch,
  type RuleIntent,
  type CatalogGroup,
  type CatalogEntry,
  type DietCatalogEntry,
} from "./catalog";

export {
  normalizePhrase,
  stemWord,
  phraseTokens,
  phraseMatchesLine,
  phraseMatchesAny,
} from "./phrase-match";

export {
  LOVE_PREFERENCE_TYPE,
  isLovePreference,
  loveLabel,
  loveTag,
  recipeHaystack,
  recipeMatchesLove,
  lovesForRecipe,
  loveScore,
  rankRecipesByLoves,
  type LovePreference,
  type RecipeLoveFields,
  type PersonLove,
  type LoveHit,
} from "./loves";

export {
  describeRuleChip,
  describeRuleSummary,
  describeSharedFacility,
  personRemovalCopy,
  ruleRemovalCopy,
  severityPhrase,
  severityTitle,
  severityExplanation,
  sharedFacilityTitle,
  sharedFacilityExplanation,
  type RuleCopyInput,
  type RuleChipCopy,
} from "./rule-copy";

export {
  intentToKind,
  kindToIntent,
  defaultSeverityForIntent,
  buildRuleWrite,
  draftFromRule,
  type RuleDraft,
  type RuleWritePayload,
} from "./rule-write";

export {
  RULE_UI_BUCKETS,
  SHARED_FACILITY_PROMPTS,
  normalizeUiBucket,
  defaultBucketForCatalogGroup,
  defaultSharedFacilityPrompt,
  intentAndSeverityForBucket,
  promptFromSharedFacility,
  sharedFacilityFromPrompt,
  showsCoconutToggle,
  showsSharedFacilityPrompt,
  uiBucketForRule,
  type RuleUiBucket,
  type LegacyRuleUiBucket,
  type SharedFacilityPrompt,
} from "./rule-ui";
