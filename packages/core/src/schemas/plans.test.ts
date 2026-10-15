import { describe, it, expect } from "vitest";
import {
  checkReportSchema,
  mealPlanSchema,
  checkFindingSchema,
  createMealPlanBodySchema,
  updateMealPlanBodySchema,
} from "./plans";

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
      expect(plan.shoppingState).toBeUndefined();
    });
  });

  describe("createMealPlanBodySchema", () => {
    const recipeId = "550e8400-e29b-41d4-a716-446655440010";
    const personId = "550e8400-e29b-41d4-a716-446655440011";

    it("accepts weekStart, status, and entries", () => {
      const body = createMealPlanBodySchema.parse({
        weekStart: "2026-11-02",
        status: "draft",
        entries: [
          {
            date: "2026-11-02",
            meal: "dinner",
            recipeId,
            servings: 4,
            attendees: [personId],
          },
        ],
      });
      expect(body.entries).toHaveLength(1);
      expect(body.entries?.[0]?.meal).toBe("dinner");
    });

    it("rejects unknown fields instead of dropping them", () => {
      const result = createMealPlanBodySchema.safeParse({
        weekStart: "2026-11-02",
        name: "Week of Nov 2",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("updateMealPlanBodySchema", () => {
    it("accepts entries and status", () => {
      const body = updateMealPlanBodySchema.parse({
        status: "approved",
        entries: [{ date: "2026-11-03", meal: "lunch" }],
      });
      expect(body.status).toBe("approved");
      expect(body.entries?.[0]?.attendees).toBeUndefined();
    });

    it("accepts shopping check-offs and extras for the plan week", () => {
      const body = updateMealPlanBodySchema.parse({
        shoppingState: {
          checkedKeys: ["basil pesto"],
          extras: [{ key: "extra-1", name: "paper towels" }],
        },
      });
      expect(body.shoppingState?.extras[0]?.name).toBe("paper towels");
    });

    it("rejects unknown fields instead of dropping them", () => {
      const result = updateMealPlanBodySchema.safeParse({
        status: "draft",
        generator: "bot",
      });
      expect(result.success).toBe(false);
    });

    it("accepts a no-cook night as a freeform meal", () => {
      const body = updateMealPlanBodySchema.parse({
        entries: [{ date: "2026-11-06", meal: "dinner", freeformMeal: "No-cook night" }],
      });
      expect(body.entries?.[0]?.freeformMeal).toBe("No-cook night");
      expect(body.entries?.[0]?.recipeId).toBeUndefined();
    });

    it("accepts a per-night clear and merge vs replace mode", () => {
      const merged = updateMealPlanBodySchema.parse({
        entries: [{ date: "2026-11-06", meal: "dinner", clear: true }],
      });
      expect(merged.entries?.[0]?.clear).toBe(true);
      expect(merged.entriesMode).toBeUndefined();

      const replaced = updateMealPlanBodySchema.parse({
        entriesMode: "replace",
        entries: [{ date: "2026-11-06", meal: "dinner", freeformMeal: "Leftovers" }],
      });
      expect(replaced.entriesMode).toBe("replace");
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
