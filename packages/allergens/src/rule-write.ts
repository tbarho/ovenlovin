/**
 * Build the exact person_rule write payload from the guided Rules UI.
 *
 * Safety: severity and sharedFacility are persisted as chosen. Shared-facility
 * "on" also sets includeMayContain and includeCrossContact so the checker
 * actually applies those relations (it requires both the flags and the enum).
 */

import type { RuleKind, Severity, SharedFacility } from "@ovenlovin/core";
import type { RuleIntent } from "./catalog";

export interface RuleDraft {
  intent: RuleIntent;
  target: string;
  severity: Severity;
  sharedFacility: SharedFacility;
  treatCoconutAsTreeNut?: boolean;
  label?: string | null;
  note?: string | null;
}

export interface RuleWritePayload {
  kind: RuleKind;
  target: string;
  severity: Severity;
  sharedFacility: SharedFacility;
  includeMayContain: boolean;
  includeCrossContact: boolean;
  includeDescendants: boolean;
  treatCoconutAsTreeNut: boolean;
  label: string | null;
  note: string | null;
}

export function intentToKind(intent: RuleIntent): RuleKind {
  if (intent === "allergy") return "allergen";
  if (intent === "diet") return "diet";
  return "ingredient";
}

export function kindToIntent(kind: RuleKind): RuleIntent {
  if (kind === "allergen") return "allergy";
  if (kind === "diet") return "diet";
  return "dislike";
}

export function defaultSeverityForIntent(intent: RuleIntent): Severity {
  return intent === "dislike" ? "prefer_avoid" : "block";
}

export function buildRuleWrite(draft: RuleDraft): RuleWritePayload {
  const target = draft.target.trim();
  if (!target) {
    throw new Error("A rule needs a target. Choose an allergen, diet, or ingredient.");
  }

  const sharedOn = draft.sharedFacility !== "ignore";

  return {
    kind: intentToKind(draft.intent),
    target,
    severity: draft.severity,
    sharedFacility: draft.sharedFacility,
    includeMayContain: sharedOn,
    includeCrossContact: sharedOn,
    includeDescendants: true,
    treatCoconutAsTreeNut: draft.treatCoconutAsTreeNut ?? false,
    label: draft.label?.trim() ? draft.label.trim() : null,
    note: draft.note?.trim() ? draft.note.trim() : null,
  };
}

export function draftFromRule(rule: {
  kind: RuleKind;
  target: string;
  severity: Severity;
  sharedFacility?: SharedFacility;
  treatCoconutAsTreeNut?: boolean;
  label?: string | null;
  note?: string | null;
}): RuleDraft {
  return {
    intent: kindToIntent(rule.kind),
    target: rule.target,
    severity: rule.severity,
    sharedFacility: rule.sharedFacility ?? "ignore",
    treatCoconutAsTreeNut: rule.treatCoconutAsTreeNut ?? false,
    label: rule.label ?? null,
    note: rule.note ?? null,
  };
}
