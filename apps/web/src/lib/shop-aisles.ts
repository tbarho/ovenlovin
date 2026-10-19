import { assignAisle } from "@ovenlovin/core/aisles";
import { formatQuantity } from "@ovenlovin/core/scaling";
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

const UNIT_PLURALS: Record<string, string> = {
  cup: "cups",
  tbsp: "tbsp",
  tsp: "tsp",
  oz: "oz",
  lb: "lbs",
  g: "g",
  kg: "kg",
  ml: "ml",
  l: "l",
  clove: "cloves",
  bunch: "bunches",
  pinch: "pinches",
  slice: "slices",
  can: "cans",
  package: "packages",
};

function quantityValue(amount: string): number {
  const parts = amount.trim().split(/\s+/);
  let total = 0;
  for (const part of parts) {
    if (part.includes("/")) {
      const [num, den] = part.split("/").map(Number);
      if (num && den) total += num / den;
      continue;
    }
    const value = Number(part);
    if (!Number.isNaN(value)) total += value;
  }
  return total;
}

export function pluralizeShopUnit(amount: string, unit: string): string {
  const trimmed = unit.trim();
  if (!trimmed) return amount;
  const quantity = quantityValue(amount);
  if (quantity > 0 && quantity <= 1) return `${amount} ${trimmed}`;
  const lower = trimmed.toLowerCase();
  const plural = UNIT_PLURALS[lower] ?? (trimmed.endsWith("s") ? trimmed : `${trimmed}s`);
  const cased =
    trimmed[0] === trimmed[0]?.toUpperCase() ? plural[0]?.toUpperCase() + plural.slice(1) : plural;
  return `${amount} ${cased}`;
}

export function shopItemQuantity(item: ShopItem): string | null {
  if (item.displayQuantity != null) {
    return item.displayUnit
      ? pluralizeShopUnit(item.displayQuantity, item.displayUnit)
      : item.displayQuantity;
  }
  if (item.quantity == null) return null;
  const amount = formatQuantity(item.quantity);
  return item.unit ? pluralizeShopUnit(amount, item.unit) : amount;
}
