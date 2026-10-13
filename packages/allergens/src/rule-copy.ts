/**
 * Human-friendly copy for per-person rules.
 *
 * Chip text is the source of truth for list cards, e.g.
 * "Allergic to tree nuts, blocks" or "Avoids dairy, prefers to avoid".
 */

import type { RuleKind, Severity, SharedFacility } from "@ovenlovin/core";
import { displayNameForTarget, humanizeTarget } from "./catalog";

export interface RuleCopyInput {
  kind: RuleKind;
  target: string;
  severity: Severity;
  sharedFacility?: SharedFacility;
  label?: string | null;
}

export interface RuleChipCopy {
  text: string;
  severity: Severity;
}

export const severityPhrase: Record<Severity, string> = {
  block: "blocks",
  warn: "warns",
  prefer_avoid: "prefers to avoid",
};

export const severityTitle: Record<Severity, string> = {
  block: "Never serve this",
  warn: "Flag for review",
  prefer_avoid: "Prefer to avoid",
};

export const severityExplanation: Record<Severity, string> = {
  block: "Unsafe for this person. Matching recipes are blocked from meals.",
  warn: "Review before serving. Use when preparation or amount matters.",
  prefer_avoid: "Not unsafe. Skip this when a good alternative is available.",
};

export const sharedFacilityTitle: Record<SharedFacility, string> = {
  ignore: "Ignore shared-facility labels",
  warn: "Warn on shared-facility labels",
  block: "Treat shared-facility foods as unsafe",
};

export const sharedFacilityExplanation: Record<SharedFacility, string> = {
  ignore: "Do not flag a food only because it was made in a facility that also processes this.",
  warn: "Warn when a label says the food was made in a facility that also processes this.",
  block: "Treat those shared-facility foods as unsafe, the same as a direct match.",
};

export function describeRuleChip(rule: RuleCopyInput): RuleChipCopy {
  const name = humanizeTarget(rule.target);
  const phrase = severityPhrase[rule.severity];

  if (rule.kind === "allergen") {
    if (rule.severity === "prefer_avoid") {
      return { text: `Avoids ${name}, ${phrase}`, severity: rule.severity };
    }
    return { text: `Allergic to ${name}, ${phrase}`, severity: rule.severity };
  }

  if (rule.kind === "diet") {
    const dietName = displayNameForTarget(rule.target);
    return { text: `${dietName}, ${phrase}`, severity: rule.severity };
  }

  return { text: `Avoids ${name}, ${phrase}`, severity: rule.severity };
}

export function describeSharedFacility(sharedFacility: SharedFacility): string | null {
  if (sharedFacility === "ignore") return null;
  return sharedFacilityTitle[sharedFacility];
}

export function describeRuleSummary(personName: string, rule: RuleCopyInput): string {
  const chip = describeRuleChip(rule);
  const facility = rule.sharedFacility ? describeSharedFacility(rule.sharedFacility) : null;
  const lead = `${personName}: ${chip.text}`;
  return facility ? `${lead}. ${facility}.` : `${lead}.`;
}
