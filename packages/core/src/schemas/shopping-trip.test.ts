import { describe, expect, it } from "vitest";
import {
  emptyShoppingTripState,
  parseShoppingTripState,
  shopItemKey,
  shoppingTripStateSchema,
  shoppingTripStateWriteSchema,
} from "./shopping-trip";

describe("shopping trip state", () => {
  it("normalizes ingredient keys so a reload can find the same check-off", () => {
    expect(shopItemKey("Basil Pesto")).toBe("basil pesto");
    expect(shopItemKey("olive-oil")).toBe("olive oil");
    expect(shopItemKey("garlic", "clove")).toBe("garlic::clove");
    expect(shopItemKey("garlic", "clove")).toBe(shopItemKey("Garlic", "Clove"));
  });

  it("drops malformed saved state instead of inventing check-offs", () => {
    expect(parseShoppingTripState(null)).toEqual(emptyShoppingTripState());
    expect(parseShoppingTripState({ checkedKeys: "pasta" })).toEqual(emptyShoppingTripState());
  });

  it("keeps extras and unique check-offs", () => {
    const state = parseShoppingTripState({
      checkedKeys: ["basil pesto", "basil pesto", "paper towels"],
      extras: [
        { key: "extra-1", name: "paper towels" },
        { key: "extra-1", name: "duplicate key" },
        { key: "extra-2", name: "  " },
      ],
    });
    expect(state.checkedKeys).toEqual(["basil pesto", "paper towels"]);
    expect(state.extras).toEqual([{ key: "extra-1", name: "paper towels" }]);
  });

  it("rejects oversized payloads", () => {
    const extras = Array.from({ length: 101 }, (_, index) => ({
      key: `extra-${index}`,
      name: "paper towels",
    }));
    expect(shoppingTripStateSchema.safeParse({ checkedKeys: [], extras }).success).toBe(false);
  });

  it("rejects unknown PATCH keys instead of stripping them", () => {
    const withExtra = {
      checkedKeys: ["eggs"],
      extras: [],
      alsoMark: true,
    };
    expect(shoppingTripStateWriteSchema.safeParse(withExtra).success).toBe(false);
    expect(shoppingTripStateSchema.safeParse(withExtra).success).toBe(true);
    expect(parseShoppingTripState(withExtra).checkedKeys).toEqual(["eggs"]);
  });
});
