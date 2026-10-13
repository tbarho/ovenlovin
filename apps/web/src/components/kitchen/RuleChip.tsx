import type { Severity } from "@ovenlovin/core";

export function RuleChip({ text, severity }: { text: string; severity: Severity }) {
  return <span className={`rule-chip rule-chip-${severity}`}>{text}</span>;
}
