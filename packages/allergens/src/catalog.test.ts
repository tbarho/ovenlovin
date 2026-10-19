import { describe, expect, it } from "vitest";
import {
  allergenCatalog,
  catalogForIntent,
  findCatalogEntry,
  humanizeTarget,
  canonicalizePersonRuleTarget,
  resolveCatalogTarget,
  ruleKindForCatalogGroup,
  searchCatalog,
  unknownRuleTargetMessage,
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

describe("resolveCatalogTarget", () => {
  it("canonicalizes a peanut typo the same way the People UI does", () => {
    const resolved = resolveCatalogTarget("pean", { kind: "allergen" });
    expect(resolved?.code).toBe("peanut");
    expect(resolved?.group).toBe("allergen");
    expect(ruleKindForCatalogGroup(resolved!.group)).toBe("allergen");
  });

  it("keeps an exact catalog code", () => {
    expect(resolveCatalogTarget("tree_nut", { kind: "allergen" })?.code).toBe("tree_nut");
  });

  it("leaves an unknown custom food alone", () => {
    expect(resolveCatalogTarget("zxqfoodnotincatalog", { kind: "ingredient" })).toBeNull();
  });

  it("canonicalizes allergen typos like peanutz", () => {
    expect(resolveCatalogTarget("peanutz", { kind: "allergen" })?.code).toBe("peanut");
    expect(canonicalizePersonRuleTarget("allergen", "peanutz")).toMatchObject({
      target: "peanut",
      resolved: true,
      canonicalized: true,
    });
  });

  it("canonicalizes common plural and phrase forms for major allergens", () => {
    expect(canonicalizePersonRuleTarget("allergen", "sesame seeds")).toMatchObject({
      target: "sesame",
      resolved: true,
      canonicalized: true,
    });
    expect(canonicalizePersonRuleTarget("allergen", "Sesame Seeds")).toMatchObject({
      target: "sesame",
      resolved: true,
    });
    expect(canonicalizePersonRuleTarget("allergen", "sesame")).toMatchObject({
      target: "sesame",
      resolved: true,
    });
    expect(canonicalizePersonRuleTarget("allergen", "mustard seeds").target).toBe("mustard");
    expect(canonicalizePersonRuleTarget("allergen", "soy beans").target).toBe("soy");
    expect(canonicalizePersonRuleTarget("allergen", "eggs").target).toBe("egg");
    expect(canonicalizePersonRuleTarget("allergen", "tree nuts").target).toBe("tree_nut");
    expect(canonicalizePersonRuleTarget("allergen", "cow's milk").target).toBe("milk");
    expect(canonicalizePersonRuleTarget("allergen", "wheat flour").target).toBe("wheat");
  });

  it("does not invent a catalog match for xyzzy", () => {
    expect(resolveCatalogTarget("xyzzy", { kind: "allergen" })).toBeNull();
    expect(canonicalizePersonRuleTarget("allergen", "xyzzy").resolved).toBe(false);
    expect(canonicalizePersonRuleTarget("custom", "blueberries").resolved).toBe(false);
    expect(unknownRuleTargetMessage("xyzzy")).toContain("confirmUnknown: true");
  });
});

describe("humanizeTarget", () => {
  it("uses household phrasing for tree nuts and dairy", () => {
    expect(humanizeTarget("tree_nut")).toBe("tree nuts");
    expect(humanizeTarget("milk")).toBe("dairy");
    expect(humanizeTarget("peanut")).toBe("peanuts");
  });
});
