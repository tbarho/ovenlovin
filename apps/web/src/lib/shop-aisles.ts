import { assignAisle } from "@ovenlovin/core/aisles";
import { pluralizeUnit } from "@ovenlovin/core";
import type { ShopItem } from "@/lib/week-plan";

const AISLE_ORDER = [
  "Produce",
  "Meat",
  "Seafood",
  "Dairy",
  "Grains",
  "Canned goods",
  "Condiments",
  "Oils & vinegar",
  "Baking",
  "Spices",
  "Pantry",
  "Frozen",
  "Other",
] as const;

export type ShopAisleGroup = {
  aisle: string;
  items: ShopItem[];
};

function aisleRank(aisle: string): number {
  const index = AISLE_ORDER.indexOf(aisle as (typeof AISLE_ORDER)[number]);
  return index === -1 ? AISLE_ORDER.length : index;
}

export function aisleForItem(name: string): string {
  return assignAisle(name).aisle;
}

export function groupShopItemsByAisle(items: ShopItem[]): ShopAisleGroup[] {
  const groups = new Map<string, ShopItem[]>();
  for (const item of items) {
    const aisle = aisleForItem(item.name);
    const list = groups.get(aisle) ?? [];
    list.push(item);
    groups.set(aisle, list);
  }
  return [...groups.entries()]
    .sort((a, b) => aisleRank(a[0]) - aisleRank(b[0]) || a[0].localeCompare(b[0]))
    .map(([aisle, groupItems]) => ({
      aisle,
      items: groupItems,
    }));
}

export function pluralizeShopUnit(amount: string, unit: string): string {
  return pluralizeUnit(amount, unit);
}

export function shopItemQuantity(item: ShopItem): string | null {
  if (item.displayQuantity != null) {
    return item.displayUnit
      ? pluralizeShopUnit(item.displayQuantity, item.displayUnit)
      : item.displayQuantity;
  }
  if (item.quantity == null) return null;
  const amount = Number.isInteger(item.quantity) ? String(item.quantity) : item.quantity.toFixed(2);
  return item.unit ? pluralizeShopUnit(amount, item.unit) : amount;
}
