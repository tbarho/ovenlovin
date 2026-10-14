/**
 * Rule checker core
 *
 * Deterministic per-person rule checking for allergen and dietary restrictions.
 * Nothing is hard-coded to fail closed; all rules are per-person configuration.
 */

import type { PersonRule, Severity, AllergenRelation } from "@ovenlovin/core";
import { hintPhrasesForTarget } from "./allergen-hints";
import { matchPhrasesForTarget } from "./catalog";
import { matchIngredient, type IngredientAllergenMapping } from "./ingredient-mapping";
import { phraseMatchesLine } from "./phrase-match";
import { getDescendants } from "./taxonomy";

export interface RuleCheckContext {
  /** The person this rule belongs to */
  personId: string;
  personName: string;
  /** The rule being checked */
  rule: PersonRule;
}

export interface IngredientCheckInput {
  /** Ingredient name or description */
  name: string;
  /** Optional: canonical ingredient ID if known */
  ingredientId?: string;
  /** Parse confidence (0-1) if from OCR/AI extraction */
  confidence?: number;
}

export interface RuleCheckFinding {
  /** Person this finding applies to */
  personId: string;
  personName: string;
  /** Rule that triggered */
  ruleId: string;
  /** Severity from the rule */
  severity: Severity;
  /** Ingredient that triggered */
  ingredientName: string;
  /** Matched allergen code */
  allergenCode: string;
  /** Allergen name */
  allergenName: string;
  /** Relation type */
  relation: AllergenRelation;
  /** Human-readable message */
  message: string;
  /** Match confidence (0-1) */
  confidence: number;
  /** Optional: ingredient notes from person_label_note */
  note?: string;
}

export interface RuleCheckResult {
  /** Status of the check */
  status: "complete" | "incomplete";
  /** Findings grouped by severity */
  findings: {
    block: RuleCheckFinding[];
    warn: RuleCheckFinding[];
    prefer_avoid: RuleCheckFinding[];
  };
  /** Reasons if incomplete */
  incompleteReasons?: string[];
}

/**
 * Check an ingredient against a person's rule
 *
 * This is the core deterministic checker: same inputs → same outputs.
 * Nothing is hard-coded; behavior is determined entirely by the rule configuration.
 */
export function checkIngredientAgainstRule(
  ingredient: IngredientCheckInput,
  context: RuleCheckContext
): RuleCheckFinding[] {
  const findings: RuleCheckFinding[] = [];
  const { rule, personId, personName } = context;

  if (rule.kind !== "allergen") {
    return checkPhraseRule(ingredient, context);
  }

  // Match ingredient to allergen mappings
  const mappings = matchIngredient(ingredient.name);

  if (mappings.length === 0) {
    // No mapping found
    if (rule.includeUnmappedIngredients) {
      // User configured to flag unmapped ingredients
      findings.push({
        personId,
        personName,
        ruleId: rule.id,
        severity: rule.severity,
        ingredientName: ingredient.name,
        allergenCode: rule.target,
        allergenName: rule.target,
        relation: "contains", // Conservative assumption
        message: formatUnmappedMessage(personName, rule, ingredient.name),
        confidence: 0.5, // Low confidence for unmapped
        note: rule.note ?? undefined,
      });
    }
    return findings;
  }

  // Check each mapping
  for (const mapping of mappings) {
    const match = checkMappingAgainstRule(mapping, rule);
    if (match) {
      findings.push({
        personId,
        personName,
        ruleId: rule.id,
        severity: rule.severity,
        ingredientName: ingredient.name,
        allergenCode: mapping.allergenCode,
        allergenName: mapping.name,
        relation: mapping.relation,
        message: formatFindingMessage(personName, rule, ingredient.name, mapping),
        confidence: ingredient.confidence ?? 0.9,
        note: rule.note ?? undefined,
      });
    }
  }

  return findings;
}

function checkPhraseRule(
  ingredient: IngredientCheckInput,
  context: RuleCheckContext
): RuleCheckFinding[] {
  const { rule, personId, personName } = context;
  const phrases = matchPhrasesForTarget(rule.target, rule.kind);
  if (rule.label) phrases.push(rule.label);

  const matched = phrases.find((phrase) => phraseMatchesLine(phrase, ingredient.name));
  if (!matched) return [];

  return [
    {
      personId,
      personName,
      ruleId: rule.id,
      severity: rule.severity,
      ingredientName: ingredient.name,
      allergenCode: rule.target,
      allergenName: rule.label?.trim() || rule.target,
      relation: "contains",
      message: formatPhraseFindingMessage(personName, rule, ingredient.name),
      confidence: ingredient.confidence ?? 0.85,
      note: rule.note ?? undefined,
    },
  ];
}

function formatPhraseFindingMessage(
  personName: string,
  rule: PersonRule,
  ingredientName: string
): string {
  const severityIcon = {
    block: "⛔",
    warn: "⚠️",
    prefer_avoid: "ℹ️",
  }[rule.severity];
  const label = rule.label?.trim() || rule.target;
  return `${severityIcon} ${personName} (${rule.severity}: ${label}). "${ingredientName}" matches ${label}.`;
}

/**
 * Check if a mapping matches a rule's target and options
 */
function checkMappingAgainstRule(mapping: IngredientAllergenMapping, rule: PersonRule): boolean {
  // Only process allergen rules (other types handled elsewhere)
  if (rule.kind !== "allergen") {
    return false;
  }

  // Check relation filters first
  if (mapping.relation === "may_contain" && !rule.includeMayContain) {
    return false;
  }

  if (mapping.relation === "commonly_cross_contact" && !rule.includeCrossContact) {
    return false;
  }

  // Handle shared facility based on rule setting
  if (mapping.relation === "commonly_cross_contact") {
    if (rule.sharedFacility === "ignore") {
      return false;
    }
    // If block or warn, we continue to check
  }

  // Direct match
  if (mapping.allergenCode === rule.target) {
    return true;
  }

  // Coconut special case
  if (
    mapping.allergenCode === "coconut" &&
    rule.target === "tree_nut" &&
    rule.treatCoconutAsTreeNut
  ) {
    return true;
  }

  // Check descendants if enabled
  if (rule.includeDescendants) {
    const descendants = getDescendants(rule.target);
    if (descendants.includes(mapping.allergenCode)) {
      return true;
    }
  }

  return false;
}

/**
 * Check multiple ingredients against a person's rules
 */
export function checkIngredientsAgainstRules(
  ingredients: IngredientCheckInput[],
  contexts: RuleCheckContext[]
): RuleCheckResult {
  const findings: RuleCheckResult["findings"] = {
    block: [],
    warn: [],
    prefer_avoid: [],
  };

  const incompleteReasons: string[] = [];

  if (ingredients.length === 0) {
    incompleteReasons.push("No ingredients provided");
  }

  if (contexts.length === 0) {
    incompleteReasons.push("No rules provided");
  }

  // Check each ingredient against each rule
  for (const ingredient of ingredients) {
    for (const context of contexts) {
      try {
        const ingredientFindings = checkIngredientAgainstRule(ingredient, context);
        for (const finding of ingredientFindings) {
          findings[finding.severity].push(finding);
        }
        if (ingredientFindings.length === 0 && matchIngredient(ingredient.name).length === 0) {
          const reason = ambiguousMatchReason(ingredient, context);
          if (reason) incompleteReasons.push(reason);
        }
      } catch (error) {
        incompleteReasons.push(
          `Error checking "${ingredient.name}" against rule ${context.rule.id}: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }
  }

  return {
    status: incompleteReasons.length > 0 ? "incomplete" : "complete",
    findings,
    incompleteReasons: incompleteReasons.length > 0 ? incompleteReasons : undefined,
  };
}

/**
 * When a line looks like it might match an allergen rule but we could not
 * classify it, the check is incomplete — never "complete with no issues".
 */
function ambiguousMatchReason(
  ingredient: IngredientCheckInput,
  context: RuleCheckContext
): string | undefined {
  const { rule, personName } = context;
  if (rule.kind !== "allergen") return undefined;

  const hints = hintPhrasesForTarget(rule.target, {
    treatCoconutAsTreeNut: rule.treatCoconutAsTreeNut,
  });
  const hinted = hints.find((hint) => phraseMatchesLine(hint, ingredient.name));
  if (!hinted) return undefined;

  return `Could not classify "${ingredient.name}" against ${personName}'s ${rule.target} rule`;
}

/**
 * Format a finding message
 */
function formatFindingMessage(
  personName: string,
  rule: PersonRule,
  ingredientName: string,
  mapping: IngredientAllergenMapping
): string {
  const severityIcon = {
    block: "⛔",
    warn: "⚠️",
    prefer_avoid: "ℹ️",
  }[rule.severity];

  const relationText = {
    contains: "contains",
    may_contain: "may contain",
    derived_from: "is derived from",
    commonly_cross_contact: "may have cross-contact with",
  }[mapping.relation];

  let message = `${severityIcon} ${personName} (${rule.severity}: ${rule.target}). `;
  message += `"${ingredientName}" ${relationText} ${mapping.name}.`;

  if (mapping.notes) {
    message += ` ${mapping.notes}`;
  }

  if (rule.label) {
    message += ` [${rule.label}]`;
  }

  return message;
}

/**
 * Format an unmapped ingredient message
 */
function formatUnmappedMessage(
  personName: string,
  rule: PersonRule,
  ingredientName: string
): string {
  const severityIcon = {
    block: "⛔",
    warn: "⚠️",
    prefer_avoid: "ℹ️",
  }[rule.severity];

  return `${severityIcon} ${personName} (${rule.severity}: ${rule.target}). "${ingredientName}" is not mapped in the allergen database. Please verify this ingredient manually.`;
}
