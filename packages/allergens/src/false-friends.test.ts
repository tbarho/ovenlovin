import { describe, expect, it } from "vitest";
import type { PersonRule } from "@ovenlovin/core";
import { matchIngredient } from "./ingredient-mapping";
import { phraseMatchesLine } from "./phrase-match";
import {
  checkIngredientAgainstRule,
  checkIngredientsAgainstRules,
  type RuleCheckContext,
} from "./rule-checker";

function createRule(overrides: Partial<PersonRule> = {}): PersonRule {
  return {
    id: overrides.id || "rule-1",
    personId: overrides.personId || "person-1",
    kind: overrides.kind || "allergen",
    target: overrides.target || "tree_nut",
    severity: overrides.severity || "block",
    includeMayContain: overrides.includeMayContain ?? false,
    includeCrossContact: overrides.includeCrossContact ?? false,
    sharedFacility: overrides.sharedFacility || "ignore",
    includeUnmappedIngredients: overrides.includeUnmappedIngredients ?? false,
    includeDescendants: overrides.includeDescendants ?? true,
    treatCoconutAsTreeNut: overrides.treatCoconutAsTreeNut ?? false,
    label: overrides.label ?? null,
    note: overrides.note ?? null,
    activeFrom: overrides.activeFrom ?? null,
    activeUntil: overrides.activeUntil ?? null,
    setBy: overrides.setBy || "admin-1",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    createdBy: "admin-1",
    deletedAt: null,
  };
}

function contextFor(rule: PersonRule, name = "Child A"): RuleCheckContext {
  return { personId: rule.personId, personName: name, rule };
}

describe("false-friend compounds", () => {
  it("does not treat butternut squash as a tree nut", () => {
    expect(matchIngredient("1 cup butternut squash")).toEqual([]);
    expect(matchIngredient("roasted butternut squash cubes")).toEqual([]);
    const rule = createRule({ target: "tree_nut", includeDescendants: true });
    expect(
      checkIngredientAgainstRule({ name: "2 cups butternut squash" }, contextFor(rule))
    ).toEqual([]);
  });

  it("does not treat nutmeg as a nut", () => {
    expect(phraseMatchesLine("nut", "1 tsp nutmeg")).toBe(false);
    expect(matchIngredient("1 tsp freshly grated nutmeg")).toEqual([]);
  });

  it("does not treat water chestnut as chestnut / tree nut", () => {
    expect(
      matchIngredient("1 cup sliced water chestnuts").some((m) => m.allergenCode === "chestnut")
    ).toBe(false);
    const rule = createRule({ target: "tree_nut", includeDescendants: true });
    expect(checkIngredientAgainstRule({ name: "8 oz water chestnuts" }, contextFor(rule))).toEqual(
      []
    );
  });

  it("does not treat coconut aminos as a tree nut or a bare nut token", () => {
    const treeNut = createRule({ target: "tree_nut", includeDescendants: true });
    expect(
      checkIngredientAgainstRule({ name: "2 tbsp coconut aminos" }, contextFor(treeNut))
    ).toEqual([]);
    expect(phraseMatchesLine("nut", "2 tbsp coconut aminos")).toBe(false);
  });

  it("still matches real chestnuts and butternut nuts", () => {
    expect(matchIngredient("1 cup roasted chestnuts")[0]?.allergenCode).toBe("chestnut");
    expect(matchIngredient("white walnut")[0]?.allergenCode).toBe("butternut");
  });
});

describe("negated allergen wording", () => {
  it("does not block dairy-free, nut-free, or egg-free lines", () => {
    const milk = createRule({ target: "milk", severity: "block" });
    const treeNut = createRule({ id: "tn", target: "tree_nut", includeDescendants: true });
    const egg = createRule({ id: "egg", target: "egg" });

    expect(checkIngredientAgainstRule({ name: "1 cup dairy-free milk" }, contextFor(milk))).toEqual(
      []
    );
    expect(
      checkIngredientAgainstRule({ name: "dairy-free cheddar shreds" }, contextFor(milk))
    ).toEqual([]);
    expect(
      checkIngredientAgainstRule({ name: "2 tbsp nut-free pesto" }, contextFor(treeNut))
    ).toEqual([]);
    expect(
      checkIngredientAgainstRule({ name: "almond-free pesto" }, contextFor(treeNut))
    ).toEqual([]);
    expect(
      checkIngredientAgainstRule(
        { name: "almond-free pesto with pine nuts" },
        contextFor(treeNut)
      ).length
    ).toBeGreaterThan(0);
    expect(checkIngredientAgainstRule({ name: "egg-free mayonnaise" }, contextFor(egg))).toEqual(
      []
    );
    expect(
      checkIngredientAgainstRule(
        { name: "without peanuts" },
        contextFor(createRule({ target: "peanut" }))
      )
    ).toEqual([]);
  });

  it("still matches the allergen when the line is not a free-of claim", () => {
    const milk = createRule({ target: "milk" });
    const egg = createRule({ id: "egg", target: "egg" });
    const treeNut = createRule({ id: "tn", target: "tree_nut", includeDescendants: true });
    expect(
      checkIngredientAgainstRule({ name: "1 cup whole milk" }, contextFor(milk)).length
    ).toBeGreaterThan(0);
    expect(
      checkIngredientAgainstRule({ name: "2 tbsp mayonnaise" }, contextFor(egg)).length
    ).toBeGreaterThan(0);
    expect(
      checkIngredientAgainstRule({ name: "1 tsp almond extract" }, contextFor(treeNut)).length
    ).toBeGreaterThan(0);
  });

  it("does not block multi-word allergen phrases followed by -free, free of, or without", () => {
    const treeNut = createRule({ target: "tree_nut", includeDescendants: true });
    const almond = createRule({ id: "almond", target: "almond" });
    const fish = createRule({ id: "fish", target: "fish" });
    const pine = createRule({ id: "pine", target: "pine_nut" });

    expect(matchIngredient("1 tsp almond extract-free flavoring")).toEqual([]);
    expect(phraseMatchesLine("almond", "almond extract-free")).toBe(false);
    expect(phraseMatchesLine("almond extract", "almond extract-free")).toBe(false);
    expect(
      checkIngredientAgainstRule({ name: "1 tsp almond extract-free" }, contextFor(treeNut))
    ).toEqual([]);
    expect(
      checkIngredientAgainstRule({ name: "almond extract-free vanilla" }, contextFor(almond))
    ).toEqual([]);
    expect(
      checkIngredientAgainstRule({ name: "free of almond extract" }, contextFor(treeNut))
    ).toEqual([]);
    expect(
      checkIngredientAgainstRule({ name: "without almond extract" }, contextFor(treeNut))
    ).toEqual([]);
    expect(checkIngredientAgainstRule({ name: "pine nut-free pesto" }, contextFor(pine))).toEqual(
      []
    );
    expect(
      checkIngredientAgainstRule({ name: "fish sauce-free marinade" }, contextFor(fish))
    ).toEqual([]);

    const extractFree = checkIngredientsAgainstRules(
      [{ name: "1 tsp almond extract-free flavoring" }],
      [contextFor(treeNut)]
    );
    expect(extractFree.status).toBe("complete");
    expect(extractFree.findings.block).toHaveLength(0);
  });

  it("does not let gluten-free hide a soy or peanut match", () => {
    const soy = createRule({ target: "soy" });
    const peanut = createRule({ id: "peanut", target: "peanut" });
    expect(
      checkIngredientAgainstRule({ name: "1 tbsp gluten-free soy sauce" }, contextFor(soy)).length
    ).toBeGreaterThan(0);
    expect(
      checkIngredientAgainstRule({ name: "gluten-free peanut sauce" }, contextFor(peanut)).length
    ).toBeGreaterThan(0);
  });

  it("returns complete with no findings for a dairy-free control line", () => {
    const result = checkIngredientsAgainstRules(
      [{ name: "1 cup dairy-free milk" }],
      [contextFor(createRule({ target: "milk" }))]
    );
    expect(result.status).toBe("complete");
    expect(result.findings.block).toHaveLength(0);
  });
});
