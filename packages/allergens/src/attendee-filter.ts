/**
 * Shared attendee filtering for search_recipes (MCP) and GET /recipes (REST).
 * A block finding for any attendee hides the recipe. Warn / prefer_avoid stay.
 */

import { collapseRuleFindings } from "./collapse-findings";
import type { RuleCheckFinding, RuleCheckResult } from "./rule-checker";

export type AttendeeWarning = {
  personId: string;
  severity: RuleCheckFinding["severity"];
  message: string;
};

export function isBlockedForAttendees(result: RuleCheckResult): boolean {
  return result.findings.block.length > 0;
}

export function attendeeWarningsFromCheck(result: RuleCheckResult): AttendeeWarning[] {
  const warnings: AttendeeWarning[] = [];
  for (const finding of collapseRuleFindings([
    ...result.findings.block,
    ...result.findings.warn,
    ...result.findings.prefer_avoid,
  ])) {
    warnings.push({
      personId: finding.personId,
      severity: finding.severity,
      message: finding.message,
    });
  }
  return warnings;
}

/** Why search hid a recipe when `forAttendees` is set. */
export type HiddenRecipeReason = {
  personId: string;
  personName: string;
  ingredientName: string;
  message: string;
};

export type HiddenRecipe = {
  id: string;
  title: string;
  reasons: HiddenRecipeReason[];
};

export function hiddenRecipeFromCheck(
  recipe: { id: string; title: string },
  result: RuleCheckResult
): HiddenRecipe | null {
  if (result.findings.block.length === 0) return null;
  return {
    id: recipe.id,
    title: recipe.title,
    reasons: result.findings.block.map((finding) => ({
      personId: finding.personId,
      personName: finding.personName,
      ingredientName: finding.ingredientName,
      message: finding.message,
    })),
  };
}
