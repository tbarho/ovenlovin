import { describe, expect, it } from "vitest";
import { budgetChips, sortCantEatChips } from "./person-card-chips";

describe("person card chips", () => {
  it("keeps allergens ahead of diets and ingredients", () => {
    const sorted = sortCantEatChips([
      { key: "1", target: "eggplant", label: "Eggplant", kind: "ingredient" },
      { key: "2", target: "sesame", label: "Sesame", kind: "allergen" },
      { key: "3", target: "vegetarian", label: "Vegetarian", kind: "diet" },
      { key: "4", target: "mustard", label: "Mustard", kind: "allergen" },
    ]);
    expect(sorted.map((item) => item.target)).toEqual([
      "mustard",
      "sesame",
      "vegetarian",
      "eggplant",
    ]);
  });

  it("shows +N more after the two-line budget", () => {
    const items = ["a", "b", "c", "d", "e", "f"];
    expect(budgetChips(items)).toEqual({ shown: ["a", "b", "c"], more: 3 });
    expect(budgetChips(["a", "b"])).toEqual({ shown: ["a", "b"], more: 0 });
  });
});
