import type { RuleCheckFinding } from "./rule-checker";
import { formatPlainFinding } from "./plain-language";

/**
 * One notice per person per allergen on a meal. Mozzarella and parmesan
 * share a dairy notice, and the copy lists both ingredients.
 */
export function collapseRuleFindings(findings: RuleCheckFinding[]): RuleCheckFinding[] {
  const groups = new Map<string, RuleCheckFinding[]>();
  for (const finding of findings) {
    const key = `${finding.personId}\0${finding.severity}\0${finding.allergenCode || finding.message}`;
    const list = groups.get(key) ?? [];
    list.push(finding);
    groups.set(key, list);
  }

  return [...groups.values()].map((group) => {
    const first = group[0]!;
    const ingredients = [
      ...new Set(group.map((finding) => finding.ingredientName.trim()).filter(Boolean)),
    ];
    if (ingredients.length <= 1) {
      return first;
    }
    return {
      ...first,
      ingredientName: ingredients.join(", "),
      message: formatPlainFinding({
        personName: first.personName,
        severity: first.severity,
        allergenCode: first.allergenCode,
        allergenName: first.allergenName,
        ingredientName: ingredients.join(", "),
        relation: first.relation,
        note: first.note,
      }),
    };
  });
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
