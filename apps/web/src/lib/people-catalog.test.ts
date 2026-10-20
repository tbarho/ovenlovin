import { describe, expect, it } from "vitest";
import {
  customCatalogOffer,
  iconIdForTarget,
  resolveFoodAdd,
  searchPeopleCatalog,
  unknownAllergenWarning,
} from "./people-catalog";

describe("people catalog search", () => {
  it("hides suggestions until the cook types", () => {
    expect(searchPeopleCatalog("")).toEqual([]);
    expect(searchPeopleCatalog("", { mode: "loves" })).toEqual([]);
    expect(searchPeopleCatalog("pean").some((entry) => entry.code === "peanut")).toBe(true);
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
    const loves = searchPeopleCatalog("salm", { mode: "loves" });
    expect(loves.some((entry) => entry.code === "salmon")).toBe(true);
    const allergies = searchPeopleCatalog("pean", { mode: "cant_eat" });
    expect(allergies.some((entry) => entry.code === "peanut")).toBe(true);
    expect(allergies.some((entry) => entry.code === "salmon")).toBe(false);
  });

  it("keeps wheat and shrimp as themselves in the kitchen add form", () => {
    expect(resolveFoodAdd("wheat", { mode: "cant_eat" })?.entry.code).toBe("wheat");
    expect(resolveFoodAdd("shrimp", { mode: "cant_eat" })?.entry.code).toBe("shrimp");
    expect(resolveFoodAdd("crab", { mode: "cant_eat" })?.entry.code).toBe("crab");
    expect(resolveFoodAdd("lobster", { mode: "cant_eat" })?.entry.code).toBe("lobster");
  });

  it("resolves sesame seeds to the sesame allergen", () => {
    expect(resolveFoodAdd("sesame seeds", { mode: "cant_eat" })?.entry.code).toBe("sesame");
    expect(resolveFoodAdd("Sesame Seeds", { mode: "cant_eat" })?.entry.code).toBe("sesame");
  });

  it("adds the typed food on Enter instead of the first suggestion", () => {
    const resolved = resolveFoodAdd("Pea", { mode: "cant_eat" });
    expect(resolved).toMatchObject({
      kind: "unknown",
      entry: { name: "Pea" },
      suggestion: { code: "peanut" },
    });
    expect(resolveFoodAdd("peanut", { mode: "cant_eat" })?.entry.code).toBe("peanut");
    expect(
      unknownAllergenWarning("Pea", resolved?.kind === "unknown" ? resolved.suggestion : null)
    ).toContain("Peanut");
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
