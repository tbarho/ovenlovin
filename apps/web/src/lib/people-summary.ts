import { displayNameForTarget, findCatalogEntry, uiBucketForRule } from "@ovenlovin/allergens";
import type { Person, PersonRule } from "@ovenlovin/core";

export type PeopleSummary = {
  line: string;
  avoids: string[];
  severeCount: number;
  badge: string | null;
};

function formatList(items: string[]): string {
  if (items.length === 0) return "";
  if (items.length === 1) return items[0] ?? "";
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
}

export function summarizePeople(people: Person[], rules: PersonRule[]): PeopleSummary {
  if (people.length === 0) {
    return {
      line: "Add the people you cook for.",
      avoids: [],
      severeCount: 0,
      badge: null,
    };
  }

  const ranked: Array<{ label: string; rank: number }> = [];
  const seen = new Set<string>();
  for (const rule of rules) {
    if (uiBucketForRule(rule) === "doesnt_like") continue;
    const entry = findCatalogEntry(rule.target);
    const label = (entry?.phraseName ?? displayNameForTarget(rule.target)).toLowerCase();
    if (seen.has(label)) continue;
    seen.add(label);
    ranked.push({ label, rank: entry?.featured ? 0 : 50 });
  }
  const avoids = ranked.sort((a, b) => a.rank - b.rank).map((item) => item.label);

  const rulesByPerson = new Map<string, PersonRule[]>();
  for (const rule of rules) {
    const list = rulesByPerson.get(rule.personId) ?? [];
    list.push(rule);
    rulesByPerson.set(rule.personId, list);
  }

  const severeCount = people.filter((person) =>
    (rulesByPerson.get(person.id) ?? []).some(
      (rule) => rule.kind === "allergen" && rule.severity === "block"
    )
  ).length;

  if (avoids.length === 0) {
    const prefers = rules.some((rule) => uiBucketForRule(rule) === "doesnt_like");
    return {
      line: prefers
        ? "Mostly easygoing, with a few preferences."
        : "Everyone here can eat everything - for now.",
      avoids,
      severeCount,
      badge: null,
    };
  }

  return {
    line: `Avoids ${formatList(avoids)}`,
    avoids,
    severeCount,
    badge:
      severeCount === 0
        ? null
        : `${severeCount} severe ${severeCount === 1 ? "allergy" : "allergies"}`,
  };
}
