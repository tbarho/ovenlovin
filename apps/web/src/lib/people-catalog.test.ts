import { describe, expect, it } from "vitest";
import { iconIdForTarget, searchPeopleCatalog } from "./people-catalog";

describe("people catalog search", () => {
  it("shows featured allergens and diets when the query is empty", () => {
    const tiles = searchPeopleCatalog("");
    expect(tiles.some((entry) => entry.code === "peanut")).toBe(true);
    expect(tiles.some((entry) => entry.code === "tree_nut")).toBe(true);
    expect(tiles.some((entry) => entry.group === "diet")).toBe(true);
  });

  it("finds tree nuts and a custom ingredient from search", () => {
    const nuts = searchPeopleCatalog("tree nut");
    expect(nuts.some((entry) => entry.code === "tree_nut" && entry.group === "allergen")).toBe(
      true
    );
    const custom = searchPeopleCatalog("durian");
    expect(custom.some((entry) => entry.code === "durian" && entry.group === "ingredient")).toBe(
      true
    );
  });

  it("maps catalog codes onto food icons", () => {
    expect(iconIdForTarget("mushrooms")).toBe("mushroom");
    expect(iconIdForTarget("tree_nut")).toBe("tree_nut");
  });
});
