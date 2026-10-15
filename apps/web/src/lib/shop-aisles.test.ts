import { describe, expect, it } from "vitest";
import { groupShopItemsByAisle } from "./shop-aisles";
import type { ShopItem } from "./week-plan";

function item(name: string): ShopItem {
  return { key: name, name, recipes: [], warnings: [] };
}

describe("groupShopItemsByAisle", () => {
  it("walks the store instead of sorting A–Z", () => {
    const groups = groupShopItemsByAisle([
      item("salt"),
      item("yellow onion"),
      item("chicken thighs"),
      item("paper towels"),
    ]);
    expect(groups.map((group) => group.aisle)).toEqual(["Produce", "Meat", "Spices", "Other"]);
    expect(groups[0]?.items.map((entry) => entry.name)).toEqual(["yellow onion"]);
  });
});
