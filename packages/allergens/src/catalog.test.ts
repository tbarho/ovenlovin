import { describe, expect, it } from "vitest";
import {
  allergenCatalog,
  catalogForIntent,
  findCatalogEntry,
  humanizeTarget,
  searchCatalog,
} from "./catalog";

describe("allergenCatalog", () => {
  it("includes peanut and tree nuts from the taxonomy", () => {
    const codes = allergenCatalog().map((entry) => entry.code);
    expect(codes).toContain("peanut");
    expect(codes).toContain("tree_nut");
    expect(codes).toContain("almond");
    expect(codes).toContain("coconut");
  });

  it("keeps coconut separate from tree nuts", () => {
    const coconut = findCatalogEntry("coconut", "allergen");
    expect(coconut?.parent).toBeUndefined();
    const almond = findCatalogEntry("almond", "allergen");
    expect(almond?.parent).toBe("tree_nut");
  });
});

describe("searchCatalog", () => {
  it("returns featured allergens when the query is empty", () => {
    const results = searchCatalog("", { intent: "allergy" });
    const codes = results.map((entry) => entry.code);
    expect(codes).toContain("peanut");
    expect(codes).toContain("tree_nut");
    expect(codes).toContain("milk");
  });

  it("finds tree nuts and peanuts for a nuts query", () => {
    const results = searchCatalog("nuts", { intent: "allergy" });
    const codes = results.map((entry) => entry.code);
    expect(["peanut", "tree_nut"]).toContain(codes[0]);
    expect(codes).toContain("peanut");
    expect(codes).toContain("tree_nut");
  });

  it("finds dairy via the milk allergen", () => {
    const results = searchCatalog("dairy", { intent: "allergy" });
    expect(results[0]?.code).toBe("milk");
  });

  it("searches the diet catalog without mixing allergens", () => {
    const results = searchCatalog("gluten", { intent: "diet" });
    expect(results.some((entry) => entry.code === "gluten_free")).toBe(true);
    expect(results.every((entry) => entry.group === "diet")).toBe(true);
  });

  it("offers common dislike suggestions instead of allergens", () => {
    const results = searchCatalog("", { intent: "dislike" });
    expect(results.every((entry) => entry.group === "ingredient")).toBe(true);
    expect(results.some((entry) => entry.code === "cilantro")).toBe(true);
    expect(catalogForIntent("dislike").every((entry) => entry.group === "ingredient")).toBe(true);
  });
});

describe("humanizeTarget", () => {
  it("uses household phrasing for tree nuts and dairy", () => {
    expect(humanizeTarget("tree_nut")).toBe("tree nuts");
    expect(humanizeTarget("milk")).toBe("dairy");
    expect(humanizeTarget("peanut")).toBe("peanuts");
  });
});
