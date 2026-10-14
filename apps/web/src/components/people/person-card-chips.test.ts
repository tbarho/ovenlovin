import { describe, expect, it } from "vitest";
import {
  budgetChips,
  sortCantEatChips,
  sortDoesntLikeChips,
  sortLoveChips,
} from "./person-card-chips";

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

  it("keeps catalog-first loves and dislikes on the visible budget", () => {
    expect(
      sortLoveChips([
        { key: "1", target: "chocolate", label: "Chocolate" },
        { key: "2", target: "pasta", label: "Pasta" },
        { key: "3", target: "salmon", label: "Salmon" },
        { key: "4", target: "mexican", label: "Mexican" },
      ]).map((item) => item.target)
    ).toEqual(["salmon", "mexican", "pasta", "chocolate"]);
    expect(
      sortDoesntLikeChips([
        { key: "1", target: "spicy", label: "Spicy food" },
        { key: "2", target: "cilantro", label: "Cilantro" },
        { key: "3", target: "olives", label: "Olives" },
      ]).map((item) => item.target)
    ).toEqual(["cilantro", "olives", "spicy"]);
  });

  it("shows +N more after the two-line budget", () => {
    const items = ["a", "b", "c", "d", "e", "f"];
    expect(budgetChips(items)).toEqual({ shown: ["a", "b", "c"], more: 3 });
    expect(budgetChips(["a", "b"])).toEqual({ shown: ["a", "b"], more: 0 });
  });
});
