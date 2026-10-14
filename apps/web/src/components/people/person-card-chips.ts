export const PERSON_CARD_CHIP_BUDGET = 4;

export type PersonCardChip = {
  key: string;
  target: string;
  label: string;
  kind?: string;
};

export function sortCantEatChips(items: PersonCardChip[]): PersonCardChip[] {
  return [...items].sort((a, b) => {
    const rank = (kind?: string) => {
      if (kind === "allergen") return 0;
      if (kind === "diet") return 1;
      return 2;
    };
    const byKind = rank(a.kind) - rank(b.kind);
    if (byKind !== 0) return byKind;
    return a.label.localeCompare(b.label);
  });
}

export function budgetChips<T>(items: T[], budget = PERSON_CARD_CHIP_BUDGET) {
  if (items.length <= budget) return { shown: items, more: 0 };
  return { shown: items.slice(0, budget), more: items.length - budget };
}
