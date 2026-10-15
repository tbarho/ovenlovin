/**
 * Regression tests from the agent tester probe lists (report section 5).
 * People and recipes stay generic - no household-specific names.
 */

import { describe, expect, it } from "vitest";
import type { PersonRule } from "@ovenlovin/core";
import { isBlockedForAttendees } from "./attendee-filter";
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
    target: overrides.target || "peanut",
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

function contextFor(personName: string, rule: PersonRule): RuleCheckContext {
  return { personId: rule.personId, personName, rule };
}

const PEANUT_PROBES = [
  "1/2 cup peanut butter",
  "1/2 cup roasted peanuts",
  "2 tbsp peanut oil",
  "3 tbsp satay sauce",
  "1/2 cup roasted peanuts", // kung pao line
];

const TREE_NUT_PROBES = [
  "1 cup walnuts",
  "1 cup almond flour",
  "1/3 cup basil pesto",
  "1/4 cup pine nuts",
  "1/2 cup cashews",
  "2 tbsp Nutella",
];

const MILK_PROBES = [
  "1 cup whole milk",
  "2 tbsp butter",
  "1/2 cup heavy cream",
  "1 cup cheddar",
  "1/4 cup grated parmesan",
  "1/2 cup sour cream",
  "2 cups buttermilk",
  "4 oz cream cheese",
];

const EGG_PROBES = ["2 eggs", "2 tbsp mayonnaise"];
const SHELLFISH_PROBES = ["1 lb shrimp", "8 oz crab"];
const FISH_PROBES = ["2 tbsp fish sauce"];

describe("tester probe ingredients (section 5)", () => {
  it("matches peanut probes on raw recipe lines", () => {
    for (const line of PEANUT_PROBES) {
      expect(
        matchIngredient(line).some((m) => m.allergenCode === "peanut"),
        line
      ).toBe(true);
    }
  });

  it("matches tree-nut probes including pesto, pine nuts, and Nutella", () => {
    const expected: Record<string, string> = {
      "1 cup walnuts": "walnut",
      "1 cup almond flour": "almond",
      "1/3 cup basil pesto": "pine_nut",
      "1/4 cup pine nuts": "pine_nut",
      "1/2 cup cashews": "cashew",
      "2 tbsp Nutella": "hazelnut",
    };
    for (const [line, code] of Object.entries(expected)) {
      expect(
        matchIngredient(line).some((m) => m.allergenCode === code),
        line
      ).toBe(true);
    }
  });

  it("keeps coconut configurable and not a tree nut by default", () => {
    const coconut = matchIngredient("1 cup coconut milk");
    expect(coconut.some((m) => m.allergenCode === "coconut")).toBe(true);
    expect(coconut.some((m) => m.allergenCode === "milk")).toBe(false);

    const treeNut = createRule({
      target: "tree_nut",
      includeDescendants: true,
      treatCoconutAsTreeNut: false,
    });
    expect(
      checkIngredientAgainstRule({ name: "1 cup coconut milk" }, contextFor("Child A", treeNut))
    ).toHaveLength(0);

    const withCoconut = createRule({
      id: "rule-coconut",
      target: "tree_nut",
      includeDescendants: true,
      treatCoconutAsTreeNut: true,
    });
    expect(
      checkIngredientAgainstRule(
        { name: "1 cup coconut milk" },
        contextFor("Child A", withCoconut)
      )[0]?.allergenCode
    ).toBe("coconut");
  });

  it("matches milk and dairy-derivative probes", () => {
    for (const line of MILK_PROBES) {
      expect(
        matchIngredient(line).some((m) => m.allergenCode === "milk"),
        line
      ).toBe(true);
    }
  });

  it("does not treat the olive-oil control as dairy", () => {
    expect(matchIngredient("2 tbsp olive oil").some((m) => m.allergenCode === "milk")).toBe(false);
  });

  it("matches egg including mayo and shellfish including shrimp and crab", () => {
    for (const line of EGG_PROBES) {
      expect(
        matchIngredient(line).some((m) => m.allergenCode === "egg"),
        line
      ).toBe(true);
    }
    expect(matchIngredient("1 lb shrimp").some((m) => m.allergenCode === "shrimp")).toBe(true);
    expect(matchIngredient("8 oz crab").some((m) => m.allergenCode === "crab")).toBe(true);
    expect(matchIngredient("2 tbsp fish sauce").some((m) => m.allergenCode === "fish")).toBe(true);
  });

  it("returns block findings for Child A peanut + tree nut on the combined probe plan", () => {
    const peanut = createRule({
      id: "peanut",
      personId: "child-a",
      target: "peanut",
      severity: "block",
    });
    const treeNut = createRule({
      id: "tree-nut",
      personId: "child-a",
      target: "tree_nut",
      severity: "block",
      includeDescendants: true,
      treatCoconutAsTreeNut: false,
    });
    const milk = createRule({
      id: "milk",
      personId: "parent-a",
      target: "milk",
      severity: "warn",
    });
    const lines = [...PEANUT_PROBES, ...TREE_NUT_PROBES, ...MILK_PROBES, "2 tbsp olive oil"].map(
      (name) => ({ name })
    );

    const result = checkIngredientsAgainstRules(lines, [
      contextFor("Child A", peanut),
      contextFor("Child A", treeNut),
      contextFor("Parent A", milk),
    ]);

    expect(result.findings.block.length).toBeGreaterThanOrEqual(5);
    expect(result.findings.block.every((f) => f.personName === "Child A")).toBe(true);
    expect(result.findings.warn.length).toBeGreaterThanOrEqual(7);
    expect(result.findings.warn.every((f) => f.personName === "Parent A")).toBe(true);
    expect(isBlockedForAttendees(result)).toBe(true);
  });

  it("blocks pesto pasta and kung pao style lines for a tree-nut / peanut block", () => {
    const peanut = createRule({ personId: "child-a", target: "peanut", severity: "block" });
    const treeNut = createRule({
      id: "tree",
      personId: "child-a",
      target: "tree_nut",
      severity: "block",
      includeDescendants: true,
    });

    const pesto = checkIngredientsAgainstRules(
      [
        { name: "1/3 cup basil pesto" },
        { name: "1/4 cup grated parmesan" },
        { name: "2 tbsp olive oil" },
      ],
      [contextFor("Child A", peanut), contextFor("Child A", treeNut)]
    );
    expect(
      pesto.findings.block.some((f) => /pesto|pine nut/i.test(f.ingredientName + f.message))
    ).toBe(true);

    const seedPesto = checkIngredientsAgainstRules(
      [{ name: "sunflower seed pesto" }],
      [contextFor("Child A", treeNut)]
    );
    expect(seedPesto.findings.block).toHaveLength(0);

    const kungPao = checkIngredientsAgainstRules(
      [{ name: "1/2 cup roasted peanuts" }],
      [contextFor("Child A", peanut)]
    );
    expect(kungPao.findings.block.length).toBeGreaterThan(0);
    expect(isBlockedForAttendees(kungPao)).toBe(true);
  });

  it("does not match olive prefer_avoid against olive oil", () => {
    const olive = createRule({
      kind: "ingredient",
      target: "olive",
      severity: "prefer_avoid",
      personId: "child-b",
    });
    const oil = checkIngredientAgainstRule(
      { name: "2 tbsp olive oil" },
      contextFor("Child B", olive)
    );
    expect(oil).toHaveLength(0);
    expect(phraseMatchesLine("olive", "2 tbsp olive oil")).toBe(false);

    const olives = checkIngredientAgainstRule(
      { name: "1/2 cup kalamata olives" },
      contextFor("Child B", olive)
    );
    expect(olives).toHaveLength(1);
  });

  it("marks egg and shellfish block rules on the untested probe lines", () => {
    const egg = createRule({ id: "egg", personId: "child-a", target: "egg", severity: "block" });
    const shellfish = createRule({
      id: "shellfish",
      personId: "child-a",
      target: "shellfish",
      severity: "block",
      includeDescendants: true,
    });
    const result = checkIngredientsAgainstRules(
      [...EGG_PROBES, ...SHELLFISH_PROBES, ...FISH_PROBES].map((name) => ({ name })),
      [contextFor("Child A", egg), contextFor("Child A", shellfish)]
    );
    expect(result.findings.block.some((f) => f.allergenCode === "egg")).toBe(true);
    expect(
      result.findings.block.some((f) => f.allergenCode === "shrimp" || f.allergenCode === "crab")
    ).toBe(true);
  });

  it("returns incomplete, never complete with no issues, when a line looks allergenic but is unknown", () => {
    const rule = createRule({ target: "milk", severity: "warn" });
    const result = checkIngredientsAgainstRules(
      [{ name: "2 tbsp unidentified dairy solids" }],
      [contextFor("Parent A", rule)]
    );
    expect(result.status).toBe("incomplete");
    expect(
      result.incompleteReasons?.some((reason) => /unidentified dairy solids/i.test(reason))
    ).toBe(true);
    expect(result.findings.warn).toHaveLength(0);
    expect(result.findings.block).toHaveLength(0);
  });

  it("stays complete with no findings for clearly non-allergenic lines", () => {
    const rule = createRule({ target: "peanut" });
    const result = checkIngredientsAgainstRules(
      [{ name: "1 tsp salt" }, { name: "2 tbsp olive oil" }],
      [contextFor("Child A", rule)]
    );
    expect(result.status).toBe("complete");
    expect(result.findings.block).toHaveLength(0);
  });
});
