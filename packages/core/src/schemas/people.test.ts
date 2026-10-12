import { describe, it, expect } from "vitest";
import { personRuleSchema, severitySchema, ruleKindSchema } from "./people";

describe("people schemas", () => {
  describe("severitySchema", () => {
    it("accepts valid severities", () => {
      expect(severitySchema.parse("block")).toBe("block");
      expect(severitySchema.parse("warn")).toBe("warn");
      expect(severitySchema.parse("prefer_avoid")).toBe("prefer_avoid");
    });

    it("rejects invalid severity", () => {
      expect(() => severitySchema.parse("invalid")).toThrow();
    });
  });

  describe("ruleKindSchema", () => {
    it("accepts all rule kinds", () => {
      const kinds = ["allergen", "ingredient", "ingredient_category", "diet", "tag", "custom"];
      kinds.forEach((kind) => {
        expect(ruleKindSchema.parse(kind)).toBe(kind);
      });
    });
  });

  describe("personRuleSchema", () => {
    it("validates a complete rule", () => {
      const rule = personRuleSchema.parse({
        id: "550e8400-e29b-41d4-a716-446655440000",
        createdAt: "2026-01-01T00:00:00Z",
        updatedAt: "2026-01-01T00:00:00Z",
        createdBy: "550e8400-e29b-41d4-a716-446655440001",
        personId: "550e8400-e29b-41d4-a716-446655440002",
        kind: "allergen",
        target: "tree_nut",
        severity: "block",
        setBy: "550e8400-e29b-41d4-a716-446655440001",
      });
      expect(rule.kind).toBe("allergen");
      expect(rule.severity).toBe("block");
      expect(rule.includeDescendants).toBe(true);
      expect(rule.treatCoconutAsTreeNut).toBe(true);
    });

    it("applies defaults", () => {
      const rule = personRuleSchema.parse({
        id: "550e8400-e29b-41d4-a716-446655440000",
        createdAt: "2026-01-01T00:00:00Z",
        updatedAt: "2026-01-01T00:00:00Z",
        createdBy: "550e8400-e29b-41d4-a716-446655440001",
        personId: "550e8400-e29b-41d4-a716-446655440002",
        kind: "allergen",
        target: "peanut",
        severity: "warn",
        setBy: "550e8400-e29b-41d4-a716-446655440001",
      });
      expect(rule.includeMayContain).toBe(false);
      expect(rule.includeCrossContact).toBe(false);
      expect(rule.sharedFacility).toBe("ignore");
      expect(rule.includeUnmappedIngredients).toBe(false);
      expect(rule.includeDescendants).toBe(true);
      expect(rule.treatCoconutAsTreeNut).toBe(true);
    });
  });
});
