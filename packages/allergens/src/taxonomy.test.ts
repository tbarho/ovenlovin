import { describe, it, expect } from "vitest";
import { allergenTaxonomy, buildAllergenMap, getDescendants, getAncestors } from "./taxonomy";

describe("allergenTaxonomy", () => {
  it("includes peanut as a top-level allergen", () => {
    const peanut = allergenTaxonomy.find((a) => a.code === "peanut");
    expect(peanut).toBeDefined();
    expect(peanut?.name).toBe("Peanut");
    expect(peanut?.children).toBeUndefined();
  });

  it("includes tree_nut with all required descendants", () => {
    const treeNut = allergenTaxonomy.find((a) => a.code === "tree_nut");
    expect(treeNut).toBeDefined();
    expect(treeNut?.children).toBeDefined();

    const childCodes = treeNut?.children?.map((c) => c.code) || [];
    expect(childCodes).toContain("almond");
    expect(childCodes).toContain("cashew");
    expect(childCodes).toContain("pecan");
    expect(childCodes).toContain("walnut");
    expect(childCodes).toContain("pistachio");
    expect(childCodes).toContain("hazelnut");
    expect(childCodes).toContain("macadamia");
    expect(childCodes).toContain("brazil_nut");
    expect(childCodes).toContain("pine_nut");
  });

  it("includes coconut as a separate top-level allergen", () => {
    const coconut = allergenTaxonomy.find((a) => a.code === "coconut");
    expect(coconut).toBeDefined();
    expect(coconut?.name).toBe("Coconut");
    expect(coconut?.description).toContain("configurable per person");
  });

  it("includes US Big 9 allergens", () => {
    const big9 = [
      "milk",
      "egg",
      "fish",
      "shellfish",
      "tree_nut",
      "peanut",
      "wheat",
      "soy",
      "sesame",
    ];
    const codes = allergenTaxonomy.map((a) => a.code);
    for (const allergen of big9) {
      expect(codes).toContain(allergen);
    }
  });

  it("includes EU 14 specific allergens", () => {
    const eu14Specific = ["mustard", "celery", "lupin", "sulfite"];
    const codes = allergenTaxonomy.map((a) => a.code);
    for (const allergen of eu14Specific) {
      expect(codes).toContain(allergen);
    }
  });
});

describe("buildAllergenMap", () => {
  it("creates a flat map with all allergens", () => {
    const map = buildAllergenMap();
    expect(map.size).toBeGreaterThan(20);
    expect(map.has("peanut")).toBe(true);
    expect(map.has("almond")).toBe(true);
    expect(map.has("tree_nut")).toBe(true);
  });

  it("records parent relationships correctly", () => {
    const map = buildAllergenMap();
    const almond = map.get("almond");
    expect(almond?.parent).toBe("tree_nut");

    const blackWalnut = map.get("black_walnut");
    expect(blackWalnut?.parent).toBe("walnut");
  });

  it("has no parent for top-level allergens", () => {
    const map = buildAllergenMap();
    const peanut = map.get("peanut");
    expect(peanut?.parent).toBeUndefined();
  });
});

describe("getDescendants", () => {
  it("returns all tree nut descendants", () => {
    const descendants = getDescendants("tree_nut");
    expect(descendants).toContain("almond");
    expect(descendants).toContain("cashew");
    expect(descendants).toContain("walnut");
    expect(descendants).toContain("black_walnut");
    expect(descendants).toContain("pine_nut");
    expect(descendants.length).toBeGreaterThan(10);
  });

  it("returns nested descendants for walnut", () => {
    const descendants = getDescendants("walnut");
    expect(descendants).toContain("black_walnut");
    expect(descendants).toContain("english_walnut");
    expect(descendants.length).toBe(2);
  });

  it("returns empty array for leaf allergens", () => {
    const descendants = getDescendants("peanut");
    expect(descendants).toEqual([]);
  });

  it("returns empty array for non-existent allergen", () => {
    const descendants = getDescendants("nonexistent");
    expect(descendants).toEqual([]);
  });

  it("includes shellfish descendants", () => {
    const descendants = getDescendants("shellfish");
    expect(descendants).toContain("crustacean");
    expect(descendants).toContain("mollusk");
    expect(descendants).toContain("shrimp");
    expect(descendants).toContain("crab");
    expect(descendants).toContain("clam");
  });
});

describe("getAncestors", () => {
  it("returns ancestors for nested allergens", () => {
    const ancestors = getAncestors("black_walnut");
    expect(ancestors).toEqual(["walnut", "tree_nut"]);
  });

  it("returns single ancestor for direct children", () => {
    const ancestors = getAncestors("almond");
    expect(ancestors).toEqual(["tree_nut"]);
  });

  it("returns empty array for top-level allergens", () => {
    const ancestors = getAncestors("peanut");
    expect(ancestors).toEqual([]);
  });

  it("returns correct ancestors for deeply nested allergens", () => {
    const ancestors = getAncestors("shrimp");
    expect(ancestors).toEqual(["crustacean", "shellfish"]);
  });
});
