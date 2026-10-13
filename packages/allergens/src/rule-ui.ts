/**
 * UI labels for the simplified People/Rules flow.
 *
 * Safety: these helpers only map labels. Persistence still goes through
 * `buildRuleWrite`, and checking still uses `checkIngredientsAgainstRules`.
 *
 * Buckets:
 * - Can't have → severity block (allergens stay kind allergen)
 * - Doesn't eat → kind diet, severity block
 * - Would rather not → severity prefer_avoid
 *
 * Shared facility prompt:
 * - Yes → sharedFacility block (and may-contain / cross-contact flags on)
 * - Ask me → sharedFacility warn
 * - No → sharedFacility ignore (flags off)
 */

import type { CatalogGroup, RuleIntent } from "./catalog";
import type { RuleKind, Severity, SharedFacility } from "@ovenlovin/core";

export type RuleUiBucket = "cant_have" | "doesnt_eat" | "rather_not";
export type SharedFacilityPrompt = "yes" | "ask" | "no";

export const RULE_UI_BUCKETS: Array<{
  bucket: RuleUiBucket;
  label: string;
  severity: Severity;
}> = [
  { bucket: "cant_have", label: "Can't have", severity: "block" },
  { bucket: "doesnt_eat", label: "Doesn't eat", severity: "block" },
  { bucket: "rather_not", label: "Would rather not", severity: "prefer_avoid" },
];

export const SHARED_FACILITY_PROMPTS: Array<{
  prompt: SharedFacilityPrompt;
  label: string;
  sharedFacility: SharedFacility;
}> = [
  { prompt: "yes", label: "Yes", sharedFacility: "block" },
  { prompt: "ask", label: "Ask me", sharedFacility: "warn" },
  { prompt: "no", label: "No", sharedFacility: "ignore" },
];

export function defaultBucketForCatalogGroup(group: CatalogGroup): RuleUiBucket {
  if (group === "allergen") return "cant_have";
  if (group === "diet") return "doesnt_eat";
  return "rather_not";
}

export function uiBucketForRule(rule: { kind: RuleKind; severity: Severity }): RuleUiBucket {
  if (rule.severity === "prefer_avoid") return "rather_not";
  if (rule.kind === "diet") return "doesnt_eat";
  if (rule.kind === "allergen" && rule.severity === "block") return "cant_have";
  if (rule.severity === "warn") return "rather_not";
  return "doesnt_eat";
}

export function intentAndSeverityForBucket(
  bucket: RuleUiBucket,
  group: CatalogGroup
): { intent: RuleIntent; severity: Severity } {
  if (bucket === "rather_not") {
    return { intent: "dislike", severity: "prefer_avoid" };
  }
  if (bucket === "doesnt_eat") {
    return { intent: group === "allergen" ? "allergy" : "diet", severity: "block" };
  }
  return {
    intent: group === "diet" ? "diet" : "allergy",
    severity: "block",
  };
}

export function sharedFacilityFromPrompt(prompt: SharedFacilityPrompt): SharedFacility {
  if (prompt === "yes") return "block";
  if (prompt === "ask") return "warn";
  return "ignore";
}

export function promptFromSharedFacility(sharedFacility: SharedFacility): SharedFacilityPrompt {
  if (sharedFacility === "block") return "yes";
  if (sharedFacility === "warn") return "ask";
  return "no";
}

export function defaultSharedFacilityPrompt(target: string): SharedFacilityPrompt {
  return target === "peanut" || target === "tree_nut" ? "ask" : "no";
}

export function showsSharedFacilityPrompt(target: string): boolean {
  return target === "peanut" || target === "tree_nut";
}

export function showsCoconutToggle(target: string): boolean {
  return target === "tree_nut";
}
