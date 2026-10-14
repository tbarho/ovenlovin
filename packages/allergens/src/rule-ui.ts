/**
 * UI labels for the simplified People/Rules flow.
 *
 * Safety: these helpers only map labels. Persistence still goes through
 * `buildRuleWrite`, and checking still uses `checkIngredientsAgainstRules`.
 *
 * Buckets:
 * - Can't eat → severity block (allergens stay kind allergen; diets stay kind diet)
 * - Doesn't like → severity prefer_avoid
 *
 * The former "Doesn't eat" diet bucket is folded into Can't eat. Existing
 * diet+block rows keep their stored kind/severity and now render under Can't eat.
 *
 * Shared facility prompt:
 * - Yes → sharedFacility block (and may-contain / cross-contact flags on)
 * - Ask me → sharedFacility warn
 * - No → sharedFacility ignore (flags off)
 */

import type { CatalogGroup, RuleIntent } from "./catalog";
import type { RuleKind, Severity, SharedFacility } from "@ovenlovin/core";

export type RuleUiBucket = "cant_eat" | "doesnt_like";
export type SharedFacilityPrompt = "yes" | "ask" | "no";

/** @deprecated Use RuleUiBucket. Kept so older UI mappings can be migrated. */
export type LegacyRuleUiBucket = "cant_have" | "doesnt_eat" | "rather_not";

export const RULE_UI_BUCKETS: Array<{
  bucket: RuleUiBucket;
  label: string;
  severity: Severity;
}> = [
  { bucket: "cant_eat", label: "Can't eat", severity: "block" },
  { bucket: "doesnt_like", label: "Doesn't like", severity: "prefer_avoid" },
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

export function normalizeUiBucket(bucket: RuleUiBucket | LegacyRuleUiBucket): RuleUiBucket {
  if (bucket === "rather_not") return "doesnt_like";
  if (bucket === "cant_have" || bucket === "doesnt_eat" || bucket === "cant_eat") {
    return "cant_eat";
  }
  return "doesnt_like";
}

export function defaultBucketForCatalogGroup(group: CatalogGroup): RuleUiBucket {
  if (group === "allergen" || group === "diet") return "cant_eat";
  return "doesnt_like";
}

export function uiBucketForRule(rule: { kind: RuleKind; severity: Severity }): RuleUiBucket {
  if (rule.severity === "prefer_avoid" || rule.severity === "warn") return "doesnt_like";
  return "cant_eat";
}

export function intentAndSeverityForBucket(
  bucket: RuleUiBucket | LegacyRuleUiBucket,
  group: CatalogGroup
): { intent: RuleIntent; severity: Severity } {
  const normalized = normalizeUiBucket(bucket);
  if (normalized === "doesnt_like") {
    return {
      intent: group === "allergen" ? "allergy" : group === "diet" ? "diet" : "dislike",
      severity: "prefer_avoid",
    };
  }
  return {
    intent: group === "diet" ? "diet" : group === "allergen" ? "allergy" : "dislike",
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
