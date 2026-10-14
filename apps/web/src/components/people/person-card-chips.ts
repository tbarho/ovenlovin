import { dislikeCatalog, loveCatalog, type CatalogEntry } from "@ovenlovin/allergens";

export const PERSON_CARD_CHIP_BUDGET = 4;

export type PersonCardChip = {
  key: string;
  target: string;
  label: string;
  kind?: string;
};

function catalogRank(target: string, catalog: CatalogEntry[]): number {
  const index = catalog.findIndex((entry) => entry.code === target);
  return index === -1 ? catalog.length : index;
}

function sortByCatalogThenLabel(
  items: PersonCardChip[],
  catalog: CatalogEntry[]
): PersonCardChip[] {
  return [...items].sort((a, b) => {
    const byCatalog = catalogRank(a.target, catalog) - catalogRank(b.target, catalog);
    if (byCatalog !== 0) return byCatalog;
    return a.label.localeCompare(b.label);
  });
}

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

/** Catalog order keeps signature likes (salmon, cilantro) on the two-line budget. */
export function sortDoesntLikeChips(items: PersonCardChip[]): PersonCardChip[] {
  return sortByCatalogThenLabel(items, dislikeCatalog);
}

export function sortLoveChips(items: PersonCardChip[]): PersonCardChip[] {
  return sortByCatalogThenLabel(items, loveCatalog);
}

export function budgetChips<T>(items: T[], budget = PERSON_CARD_CHIP_BUDGET) {
  if (items.length <= budget) return { shown: items, more: 0 };
  const shownCount = Math.max(1, budget - 1);
  return { shown: items.slice(0, shownCount), more: items.length - shownCount };
}
