import type { RuleCheckFinding } from "./rule-checker";

/**
 * One notice per person per meal: mozzarella and parmesan should not
 * each emit the same "Contains dairy, so check with Parent A first".
 */
export function collapseRuleFindings(findings: RuleCheckFinding[]): RuleCheckFinding[] {
  const seen = new Map<string, RuleCheckFinding>();
  for (const finding of findings) {
    const key = `${finding.personId}\0${finding.severity}\0${finding.message}`;
    if (!seen.has(key)) {
      seen.set(key, finding);
    }
  }
  return [...seen.values()];
}

export function uniqueWarningCopy<T extends { personName: string; message: string }>(
  warnings: T[]
): T[] {
  const seen = new Set<string>();
  const unique: T[] = [];
  for (const warning of warnings) {
    const key = `${warning.personName}\0${warning.message}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(warning);
  }
  return unique;
}
