import { describe, it, expect } from "vitest";
import type { PersonRule } from "@ovenlovin/core";
import {
  checkIngredientAgainstRule,
  checkIngredientsAgainstRules,
  type RuleCheckContext,
  type IngredientCheckInput,
} from "./rule-checker";

// Helper to create a test person rule
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

// Helper to create a test context
function createContext(personName: string, rule: PersonRule): RuleCheckContext {
  return {
    personId: rule.personId,
    personName,
    rule,
  };
}

describe("checkIngredientAgainstRule", () => {
  describe("direct matches", () => {
    it("flags peanuts for peanut rule", () => {
      const rule = createRule({ target: "peanut", severity: "block" });
      const context = createContext("Child A", rule);
      const ingredient: IngredientCheckInput = { name: "peanuts" };

      const findings = checkIngredientAgainstRule(ingredient, context);

      expect(findings).toHaveLength(1);
      expect(findings[0]?.severity).toBe("block");
      expect(findings[0]?.allergenCode).toBe("peanut");
      expect(findings[0]?.message).toContain("Child A");
      expect(findings[0]?.message).toMatch(/can't eat this/);
      expect(findings[0]?.message).not.toMatch(/block\s*:/);
    });

    it("flags almonds for almond rule", () => {
      const rule = createRule({ target: "almond", severity: "warn" });
      const context = createContext("Parent B", rule);
      const ingredient: IngredientCheckInput = { name: "almonds" };

      const findings = checkIngredientAgainstRule(ingredient, context);

      expect(findings).toHaveLength(1);
      expect(findings[0]?.severity).toBe("warn");
      expect(findings[0]?.allergenCode).toBe("almond");
    });
  });

  describe("includeDescendants", () => {
    it("flags almond when tree_nut rule has includeDescendants=true", () => {
      const rule = createRule({
        target: "tree_nut",
        severity: "block",
        includeDescendants: true,
      });
      const context = createContext("Child A", rule);
      const ingredient: IngredientCheckInput = { name: "almond" };

      const findings = checkIngredientAgainstRule(ingredient, context);

      expect(findings).toHaveLength(1);
      expect(findings[0]?.severity).toBe("block");
    });

    it("does not flag almond when tree_nut rule has includeDescendants=false", () => {
      const rule = createRule({
        target: "tree_nut",
        severity: "block",
        includeDescendants: false,
      });
      const context = createContext("Child A", rule);
      const ingredient: IngredientCheckInput = { name: "almond" };

      const findings = checkIngredientAgainstRule(ingredient, context);

      expect(findings).toHaveLength(0);
    });

    it("flags all tree nuts when includeDescendants=true", () => {
      const rule = createRule({
        target: "tree_nut",
        severity: "block",
        includeDescendants: true,
      });
      const context = createContext("Child A", rule);

      const treeNuts = [
        "almond",
        "cashew",
        "pecan",
        "walnut",
        "pistachio",
        "hazelnut",
        "macadamia",
        "brazil nut",
        "pine nut",
      ];

      for (const nut of treeNuts) {
        const findings = checkIngredientAgainstRule({ name: nut }, context);
        expect(findings.length).toBeGreaterThan(0);
      }
    });
  });

  describe("treatCoconutAsTreeNut", () => {
    it("flags coconut when tree_nut rule has treatCoconutAsTreeNut=true", () => {
      const rule = createRule({
        target: "tree_nut",
        severity: "block",
        treatCoconutAsTreeNut: true,
      });
      const context = createContext("Child A", rule);
      const ingredient: IngredientCheckInput = { name: "coconut" };

      const findings = checkIngredientAgainstRule(ingredient, context);

      expect(findings).toHaveLength(1);
      expect(findings[0]?.allergenCode).toBe("coconut");
    });

    it("does not flag coconut when tree_nut rule has treatCoconutAsTreeNut=false", () => {
      const rule = createRule({
        target: "tree_nut",
        severity: "block",
        treatCoconutAsTreeNut: false,
      });
      const context = createContext("Child A", rule);
      const ingredient: IngredientCheckInput = { name: "coconut" };

      const findings = checkIngredientAgainstRule(ingredient, context);

      expect(findings).toHaveLength(0);
    });

    it("does not flag coconut on a tree_nut rule when the coconut flag is omitted", () => {
      const rule = createRule({
        target: "tree_nut",
        severity: "block",
      });
      expect(rule.treatCoconutAsTreeNut).toBe(false);
      const findings = checkIngredientAgainstRule(
        { name: "1 cup coconut milk" },
        createContext("Child A", rule)
      );
      expect(findings).toHaveLength(0);
    });
  });

  describe("includeMayContain", () => {
    it("flags may_contain when includeMayContain=true", () => {
      const rule = createRule({
        target: "tree_nut",
        severity: "warn",
        includeMayContain: true,
      });
      const context = createContext("Child A", rule);
      // Note: We don't have any may_contain mappings in current data,
      // so this test is structural. In a real scenario, we'd add may_contain mappings.
      const ingredient: IngredientCheckInput = { name: "chocolate chips" };

      const findings = checkIngredientAgainstRule(ingredient, context);

      // chocolate chips has commonly_cross_contact, not may_contain,
      // but the test structure is here for when we add may_contain mappings
      expect(findings).toBeDefined();
    });
  });

  describe("includeCrossContact", () => {
    it("flags cross-contact when includeCrossContact=true", () => {
      const rule = createRule({
        target: "tree_nut",
        severity: "warn",
        includeCrossContact: true,
        sharedFacility: "warn",
      });
      const context = createContext("Child A", rule);
      const ingredient: IngredientCheckInput = { name: "chocolate chips" };

      const findings = checkIngredientAgainstRule(ingredient, context);

      expect(findings).toHaveLength(1);
      expect(findings[0]?.relation).toBe("commonly_cross_contact");
    });

    it("does not flag cross-contact when includeCrossContact=false", () => {
      const rule = createRule({
        target: "tree_nut",
        severity: "warn",
        includeCrossContact: false,
      });
      const context = createContext("Child A", rule);
      const ingredient: IngredientCheckInput = { name: "chocolate chips" };

      const findings = checkIngredientAgainstRule(ingredient, context);

      expect(findings).toHaveLength(0);
    });
  });

  describe("sharedFacility", () => {
    it("ignores cross-contact when sharedFacility=ignore", () => {
      const rule = createRule({
        target: "tree_nut",
        severity: "warn",
        includeCrossContact: true,
        sharedFacility: "ignore",
      });
      const context = createContext("Child A", rule);
      const ingredient: IngredientCheckInput = { name: "chocolate chips" };

      const findings = checkIngredientAgainstRule(ingredient, context);

      expect(findings).toHaveLength(0);
    });

    it("warns on cross-contact when sharedFacility=warn", () => {
      const rule = createRule({
        target: "tree_nut",
        severity: "block",
        includeCrossContact: true,
        sharedFacility: "warn",
      });
      const context = createContext("Child A", rule);
      const ingredient: IngredientCheckInput = { name: "granola" };

      const findings = checkIngredientAgainstRule(ingredient, context);

      expect(findings).toHaveLength(1);
    });

    it("blocks on cross-contact when sharedFacility=block", () => {
      const rule = createRule({
        target: "tree_nut",
        severity: "block",
        includeCrossContact: true,
        sharedFacility: "block",
      });
      const context = createContext("Child A", rule);
      const ingredient: IngredientCheckInput = { name: "energy bar" };

      const findings = checkIngredientAgainstRule(ingredient, context);

      expect(findings).toHaveLength(1);
    });
  });

  describe("includeUnmappedIngredients", () => {
    it("flags unmapped ingredient when includeUnmappedIngredients=true", () => {
      const rule = createRule({
        target: "peanut",
        severity: "warn",
        includeUnmappedIngredients: true,
      });
      const context = createContext("Child A", rule);
      const ingredient: IngredientCheckInput = { name: "mysterious paste" };

      const findings = checkIngredientAgainstRule(ingredient, context);

      expect(findings).toHaveLength(1);
      expect(findings[0]?.message).toMatch(/could not confirm/i);
      expect(findings[0]?.message).toContain("mysterious paste");
    });

    it("does not flag unmapped when includeUnmappedIngredients=false", () => {
      const rule = createRule({
        target: "peanut",
        severity: "warn",
        includeUnmappedIngredients: false,
      });
      const context = createContext("Child A", rule);
      const ingredient: IngredientCheckInput = { name: "mysterious paste" };

      const findings = checkIngredientAgainstRule(ingredient, context);

      expect(findings).toHaveLength(0);
    });
  });

  describe("hidden nuts", () => {
    it("flags pesto for tree_nut rule (contains pine nuts)", () => {
      const rule = createRule({
        target: "tree_nut",
        severity: "block",
        includeDescendants: true,
      });
      const context = createContext("Child A", rule);
      const ingredient: IngredientCheckInput = { name: "pesto" };

      const findings = checkIngredientAgainstRule(ingredient, context);

      expect(findings).toHaveLength(1);
      expect(findings[0]?.allergenCode).toBe("pine_nut");
    });

    it("flags marzipan for tree_nut rule (contains almonds)", () => {
      const rule = createRule({
        target: "tree_nut",
        severity: "block",
        includeDescendants: true,
      });
      const context = createContext("Child A", rule);
      const ingredient: IngredientCheckInput = { name: "marzipan" };

      const findings = checkIngredientAgainstRule(ingredient, context);

      expect(findings).toHaveLength(1);
      expect(findings[0]?.allergenCode).toBe("almond");
    });

    it("flags satay for peanut rule", () => {
      const rule = createRule({ target: "peanut", severity: "block" });
      const context = createContext("Child A", rule);
      const ingredient: IngredientCheckInput = { name: "satay sauce" };

      const findings = checkIngredientAgainstRule(ingredient, context);

      expect(findings).toHaveLength(1);
      expect(findings[0]?.allergenCode).toBe("peanut");
    });

    it("flags baklava for tree_nut rule", () => {
      const rule = createRule({
        target: "tree_nut",
        severity: "block",
        includeDescendants: true,
      });
      const context = createContext("Child A", rule);
      const ingredient: IngredientCheckInput = { name: "baklava" };

      const findings = checkIngredientAgainstRule(ingredient, context);

      expect(findings).toHaveLength(1);
      expect(findings[0]?.allergenCode).toBe("tree_nut");
    });

    it("flags gianduja for hazelnut rule", () => {
      const rule = createRule({ target: "hazelnut", severity: "block" });
      const context = createContext("Child A", rule);
      const ingredient: IngredientCheckInput = { name: "gianduja" };

      const findings = checkIngredientAgainstRule(ingredient, context);

      expect(findings).toHaveLength(1);
      expect(findings[0]?.allergenCode).toBe("hazelnut");
    });
  });

  describe("severity levels", () => {
    it("returns block severity", () => {
      const rule = createRule({ target: "peanut", severity: "block" });
      const context = createContext("Child A", rule);
      const ingredient: IngredientCheckInput = { name: "peanut" };

      const findings = checkIngredientAgainstRule(ingredient, context);

      expect(findings[0]?.severity).toBe("block");
    });

    it("returns warn severity", () => {
      const rule = createRule({ target: "peanut", severity: "warn" });
      const context = createContext("Child A", rule);
      const ingredient: IngredientCheckInput = { name: "peanut" };

      const findings = checkIngredientAgainstRule(ingredient, context);

      expect(findings[0]?.severity).toBe("warn");
    });

    it("returns prefer_avoid severity", () => {
      const rule = createRule({ target: "peanut", severity: "prefer_avoid" });
      const context = createContext("Child A", rule);
      const ingredient: IngredientCheckInput = { name: "peanut" };

      const findings = checkIngredientAgainstRule(ingredient, context);

      expect(findings[0]?.severity).toBe("prefer_avoid");
    });
  });

  describe("message formatting", () => {
    it("includes person name in message", () => {
      const rule = createRule({ target: "peanut", severity: "block" });
      const context = createContext("Child A", rule);
      const ingredient: IngredientCheckInput = { name: "peanut" };

      const findings = checkIngredientAgainstRule(ingredient, context);

      expect(findings[0]?.message).toContain("Child A");
    });

    it("says the person cannot eat this instead of a severity code", () => {
      const rule = createRule({ target: "peanut", severity: "block" });
      const context = createContext("Child A", rule);
      const ingredient: IngredientCheckInput = { name: "peanut" };

      const findings = checkIngredientAgainstRule(ingredient, context);

      expect(findings[0]?.message).toMatch(/can't eat this/);
      expect(findings[0]?.message).not.toMatch(/block\s*:/);
      expect(findings[0]?.message).not.toMatch(/tree_nut|prefer_avoid/);
    });

    it("names the food in plain language", () => {
      const rule = createRule({ target: "peanut", severity: "block" });
      const context = createContext("Child A", rule);
      const ingredient: IngredientCheckInput = { name: "peanut butter" };

      const findings = checkIngredientAgainstRule(ingredient, context);

      expect(findings[0]?.message).toMatch(/peanut/i);
      expect(findings[0]?.message).toContain("Child A");
    });

    it("includes rule label when present", () => {
      const rule = createRule({
        target: "peanut",
        severity: "block",
        label: "anaphylactic, carries EpiPen",
      });
      const context = createContext("Child A", rule);
      const ingredient: IngredientCheckInput = { name: "peanut" };

      const findings = checkIngredientAgainstRule(ingredient, context);

      expect(findings[0]?.message).toContain("anaphylactic, carries EpiPen");
    });
  });
});

describe("checkIngredientsAgainstRules", () => {
  it("checks multiple ingredients against multiple rules", () => {
    const rule1 = createRule({
      id: "rule-1",
      personId: "person-1",
      target: "peanut",
      severity: "block",
    });
    const rule2 = createRule({
      id: "rule-2",
      personId: "person-2",
      target: "tree_nut",
      severity: "warn",
      includeDescendants: true,
    });

    const contexts = [createContext("Child A", rule1), createContext("Child B", rule2)];

    const ingredients: IngredientCheckInput[] = [
      { name: "peanut butter" },
      { name: "almond milk" },
    ];

    const result = checkIngredientsAgainstRules(ingredients, contexts);

    expect(result.status).toBe("complete");
    expect(result.findings.block.length).toBeGreaterThan(0);
    expect(result.findings.warn.length).toBeGreaterThan(0);
  });

  it("reports incomplete when no ingredients", () => {
    const rule = createRule({ target: "peanut", severity: "block" });
    const contexts = [createContext("Child A", rule)];

    const result = checkIngredientsAgainstRules([], contexts);

    expect(result.status).toBe("incomplete");
    expect(result.incompleteReasons).toContain("No ingredients provided");
  });

  it("reports incomplete when no rules", () => {
    const ingredients: IngredientCheckInput[] = [{ name: "peanut" }];

    const result = checkIngredientsAgainstRules(ingredients, []);

    expect(result.status).toBe("incomplete");
    expect(result.incompleteReasons).toContain("No rules provided");
  });

  it("groups findings by severity", () => {
    const blockRule = createRule({
      id: "rule-1",
      personId: "person-1",
      target: "peanut",
      severity: "block",
    });
    const warnRule = createRule({
      id: "rule-2",
      personId: "person-2",
      target: "almond",
      severity: "warn",
    });

    const contexts = [createContext("Child A", blockRule), createContext("Child B", warnRule)];

    const ingredients: IngredientCheckInput[] = [{ name: "peanut" }, { name: "almond" }];

    const result = checkIngredientsAgainstRules(ingredients, contexts);

    expect(result.findings.block).toHaveLength(1);
    expect(result.findings.warn).toHaveLength(1);
    expect(result.findings.prefer_avoid).toHaveLength(0);
  });

  it("flags kung pao dried chiles for a spicy-averse person", () => {
    const rule = createRule({
      kind: "tag",
      target: "spicy",
      severity: "prefer_avoid",
    });
    const findings = checkIngredientAgainstRule(
      { name: "4 dried chiles" },
      createContext("Test Adult 7", rule)
    );
    expect(findings).toHaveLength(1);
    expect(findings[0]?.severity).toBe("prefer_avoid");
    expect(findings[0]?.allergenCode).toBe("spicy");
    expect(findings[0]?.ingredientName).toBe("4 dried chiles");
    expect(
      checkIngredientAgainstRule({ name: "1 tsp cayenne" }, createContext("Test Adult 7", rule))
    ).toHaveLength(1);
    expect(
      checkIngredientAgainstRule({ name: "1 tsp chipotle" }, createContext("Test Adult 7", rule))
    ).toHaveLength(1);
    expect(
      checkIngredientAgainstRule({ name: "hot water" }, createContext("Test Adult 7", rule))
    ).toHaveLength(0);
    expect(
      checkIngredientAgainstRule({ name: "hot dog buns" }, createContext("Test Adult 7", rule))
    ).toHaveLength(0);
    expect(
      checkIngredientAgainstRule(
        { name: "1 tsp pumpkin pie spice" },
        createContext("Test Adult 7", rule)
      )
    ).toHaveLength(0);
    expect(
      checkIngredientAgainstRule(
        { name: "2 tbsp sweet chili sauce" },
        createContext("Test Adult 7", rule)
      )
    ).toHaveLength(0);
  });

  describe("deterministic behavior", () => {
    it("returns same results for same inputs", () => {
      const rule = createRule({ target: "peanut", severity: "block" });
      const contexts = [createContext("Child A", rule)];
      const ingredients: IngredientCheckInput[] = [{ name: "peanut" }];

      const result1 = checkIngredientsAgainstRules(ingredients, contexts);
      const result2 = checkIngredientsAgainstRules(ingredients, contexts);

      expect(result1.status).toBe(result2.status);
      expect(result1.findings.block.length).toBe(result2.findings.block.length);
      expect(result1.findings.warn.length).toBe(result2.findings.warn.length);
      expect(result1.findings.prefer_avoid.length).toBe(result2.findings.prefer_avoid.length);
    });
  });
});
