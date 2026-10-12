import { describe, it, expect } from "vitest";
import { checkReportSchema, mealPlanSchema, checkFindingSchema } from "./plans";

describe("plans schemas", () => {
  describe("mealPlanSchema", () => {
    it("validates a complete meal plan", () => {
      const plan = mealPlanSchema.parse({
        id: "550e8400-e29b-41d4-a716-446655440000",
        createdAt: "2026-01-01T00:00:00Z",
        updatedAt: "2026-01-01T00:00:00Z",
        createdBy: "550e8400-e29b-41d4-a716-446655440001",
        householdId: "550e8400-e29b-41d4-a716-446655440002",
        weekStart: "2026-01-06",
        status: "draft",
      });
      expect(plan.status).toBe("draft");
      expect(plan.needsRecheck).toBe(false);
    });
  });

  describe("checkReportSchema", () => {
    it("validates a check report", () => {
      const report = checkReportSchema.parse({
        status: "complete",
        planId: "550e8400-e29b-41d4-a716-446655440000",
        checkedAt: "2026-01-01T00:00:00Z",
        findings: [],
        summary: {
          totalEntries: 7,
          entriesWithBlocks: 0,
          entriesWithWarnings: 1,
          affectedPeople: ["550e8400-e29b-41d4-a716-446655440001"],
        },
      });
      expect(report.status).toBe("complete");
      expect(report.findings).toHaveLength(0);
    });

    it("validates findings with blocks", () => {
      const finding = checkFindingSchema.parse({
        entryId: "550e8400-e29b-41d4-a716-446655440000",
        personId: "550e8400-e29b-41d4-a716-446655440001",
        personName: "Child A",
        severity: "block",
        message: "Contains tree nuts",
        evidence: { ingredient: "almond flour", confidence: 0.95 },
      });
      expect(finding.severity).toBe("block");
      expect(finding.message).toBe("Contains tree nuts");
    });
  });
});
