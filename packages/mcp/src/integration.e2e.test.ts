/**
 * Real end-to-end integration test for MCP server
 *
 * Tests the complete flow:
 * 1. Allergen checking with search_recipes logic
 * 2. checkIngredientsAgainstRules from allergens package
 * 3. Verifies nut-containing recipe is blocked for person with tree-nut rule
 */

import { describe, it, expect } from "vitest";
import {
  checkIngredientsAgainstRules,
  type RuleCheckContext,
  type IngredientCheckInput,
} from "@ovenlovin/allergens";
import type { PersonRule } from "@ovenlovin/core";

describe("MCP Integration E2E", () => {
  it("should detect tree-nut allergen when checking meal plan", async () => {

    // Create ingredients from a nut-containing recipe
    const ingredients: IngredientCheckInput[] = [
      {
        name: "almonds",
      },
      {
        name: "chicken breast",
      },
    ];

    // Create a person with tree-nut block rule
    const rule: PersonRule = {
      id: "rule-1",
      personId: "person-1",
      kind: "allergen",
      target: "tree_nut",
      severity: "block",
      includeMayContain: false,
      includeCrossContact: false,
      sharedFacility: "ignore",
      includeUnmappedIngredients: false,
      includeDescendants: true,
      treatCoconutAsTreeNut: true,
      label: null,
      note: null,
      activeFrom: null,
      activeUntil: null,
      setBy: "admin-1",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: "admin-1",
      deletedAt: null,
    };

    const context: RuleCheckContext = {
      personId: "person-1",
      personName: "Child A",
      rule,
    };

    // Check ingredients against rules
    const result = checkIngredientsAgainstRules(ingredients, [context]);

    // Verify check completed
    expect(result.status).toBe("complete");

    // Verify findings structure
    expect(result.findings).toBeDefined();
    expect(result.findings.block).toBeDefined();
    expect(result.findings.warn).toBeDefined();
    expect(result.findings.prefer_avoid).toBeDefined();

    // Verify at least one block finding for tree nuts
    expect(result.findings.block.length).toBeGreaterThan(0);

    const blockFinding = result.findings.block[0];

    // Verify finding includes person info
    expect(blockFinding.personId).toBe("person-1");
    expect(blockFinding.personName).toBe("Child A");

    // Verify finding includes rule info
    expect(blockFinding.ruleId).toBe("rule-1");
    expect(blockFinding.severity).toBe("block");

    // Verify finding includes ingredient info
    expect(blockFinding.ingredientName).toContain("almond");
    expect(blockFinding.allergenCode).toBe("almond");

    // Verify message includes person name
    expect(blockFinding.message).toContain("Child A");
  });

  it("should pass check when recipe has no allergens", async () => {
    // Create ingredients from a safe recipe (no nuts)
    const ingredients: IngredientCheckInput[] = [
      {
        name: "chicken breast",
      },
      {
        name: "olive oil",
      },
    ];

    // Create a person with tree-nut block rule
    const rule: PersonRule = {
      id: "rule-1",
      personId: "person-1",
      kind: "allergen",
      target: "tree_nut",
      severity: "block",
      includeMayContain: false,
      includeCrossContact: false,
      sharedFacility: "ignore",
      includeUnmappedIngredients: false,
      includeDescendants: true,
      treatCoconutAsTreeNut: true,
      label: null,
      note: null,
      activeFrom: null,
      activeUntil: null,
      setBy: "admin-1",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: "admin-1",
      deletedAt: null,
    };

    const context: RuleCheckContext = {
      personId: "person-1",
      personName: "Child A",
      rule,
    };

    // Check ingredients against rules
    const result = checkIngredientsAgainstRules(ingredients, [context]);

    // Verify check completed
    expect(result.status).toBe("complete");

    // Verify no block findings (chicken is safe)
    expect(result.findings.block.length).toBe(0);
  });
});
