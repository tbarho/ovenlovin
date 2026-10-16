import { describe, expect, it } from "vitest";
import {
  customCatalogOffer,
  iconIdForTarget,
  resolveFoodAdd,
  searchPeopleCatalog,
  unknownAllergenWarning,
} from "./people-catalog";

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
    const custom = customCatalogOffer("durian");
    expect(custom?.code).toBe("durian");
    expect(customCatalogOffer("peanut")).toBeNull();
  });

  it("features Loves suggestions separately from Can't eat", () => {
    const loves = searchPeopleCatalog("", { mode: "loves" });
    expect(loves.some((entry) => entry.code === "salmon")).toBe(true);
    expect(loves.some((entry) => entry.code === "mexican")).toBe(true);
  });

  it("resolves a peanut typo to the canonical allergen", () => {
    const resolved = resolveFoodAdd("pean", { mode: "cant_eat" });
    expect(resolved?.kind).toBe("canonical");
    expect(resolved?.entry.code).toBe("peanut");
    expect(customCatalogOffer("pean")?.code).toBe("pean");
    expect(unknownAllergenWarning("Pean", resolved?.entry ?? null)).toContain("Peanut");
    expect(resolveFoodAdd("peanutz", { mode: "cant_eat" })?.entry.code).toBe("peanut");
  });

  it("flags a free-text allergen that is not in the catalog", () => {
    const resolved = resolveFoodAdd("xyzzy", { mode: "cant_eat" });
    expect(resolved).toEqual({
      kind: "unknown",
      entry: expect.objectContaining({ code: "xyzzy", name: "xyzzy" }),
      suggestion: null,
    });
    expect(unknownAllergenWarning("xyzzy", null)).toMatch(/can't check 'xyzzy'/i);
  });

  it("maps catalog codes onto food icons", () => {
    expect(iconIdForTarget("mushrooms")).toBe("mushroom");
    expect(iconIdForTarget("tree_nut")).toBe("tree_nut");
  });
});
