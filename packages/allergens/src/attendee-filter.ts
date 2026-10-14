/**
 * Shared attendee filtering for search_recipes (MCP) and GET /recipes (REST).
 * A block finding for any attendee hides the recipe. Warn / prefer_avoid stay.
 */

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
  for (const finding of [
    ...result.findings.block,
    ...result.findings.warn,
    ...result.findings.prefer_avoid,
  ]) {
    warnings.push({
      personId: finding.personId,
      severity: finding.severity,
      message: finding.message,
    });
  }
  return warnings;
}
