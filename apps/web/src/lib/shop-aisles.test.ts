import { describe, expect, it } from "vitest";
import { groupShopItemsByAisle, pluralizeShopUnit, shopItemQuantity } from "./shop-aisles";
import type { ShopItem } from "./week-plan";

function item(name: string): ShopItem {
  return { key: name, name, recipes: [], warnings: [] };
}

describe("groupShopItemsByAisle", () => {
  it("walks the store instead of sorting A-Z", () => {
    const groups = groupShopItemsByAisle([
      item("salt"),
      item("yellow onion"),
      item("chicken thighs"),
      item("paper towels"),
      item("extra-firm tofu"),
      item("kalamata olives"),
    ]);
    expect(groups.map((group) => group.aisle)).toEqual([
      "Produce",
      "Meat",
      "Refrigerated",
      "Canned goods",
      "Spices",
      "Other",
    ]);
    expect(groups[0]?.items.map((entry) => entry.name)).toEqual(["yellow onion"]);
  });
});

describe("shopItemQuantity", () => {
  it("pluralizes shopping units", () => {
    expect(pluralizeShopUnit("2", "cup")).toBe("2 cups");
    expect(pluralizeShopUnit("1", "cup")).toBe("1 cup");
    expect(pluralizeShopUnit("2", "clove")).toBe("2 cloves");
    expect(pluralizeShopUnit("1/3", "cup")).toBe("1/3 cup");
    expect(pluralizeShopUnit("1/8", "cup")).toBe("1/8 cup");
    expect(
      shopItemQuantity({
        key: "salt",
        name: "salt",
        displayQuantity: "1 2/3",
        displayUnit: "tbsp",
        recipes: [],
        warnings: [],
      })
    ).toBe("1 2/3 tbsp");
  });

  it("formats a numeric quantity as a cooking fraction when displayQuantity is missing", () => {
    expect(
      shopItemQuantity({
        key: "celery",
        name: "celery",
        quantity: 0.6666666667,
        unit: "cup",
        recipes: [],
        warnings: [],
      })
    ).toBe("2/3 cup");
  });
});
