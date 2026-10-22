import { describe, expect, it, vi } from "vitest";
import { PlanService } from "./plans";

const GONE = "550e8400-e29b-41d4-a716-446655440099";
const PESTO = "550e8400-e29b-41d4-a716-446655440010";
const PLAN_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const HOUSEHOLD = "22222222-2222-4222-8222-222222222222";

function planRow() {
  return {
    id: PLAN_ID,
    createdAt: "2026-10-12T00:00:00.000Z",
    updatedAt: "2026-10-12T00:00:00.000Z",
    deletedAt: null,
    createdBy: "user-1",
    householdId: HOUSEHOLD,
    weekStart: "2026-10-12",
    cookFor: 4,
    status: "draft" as const,
    generator: null,
    generatorModel: null,
    latestCheckReport: null,
    checkedAt: null,
    contentHash: null,
    acknowledgedWarnings: [],
    needsRecheck: false,
    createdByApiKeyId: null,
  };
}

function entry(recipeId: string | null, date: string) {
  return {
    id: `${date}-dinner`,
    createdAt: "2026-10-12T00:00:00.000Z",
    updatedAt: "2026-10-12T00:00:00.000Z",
    deletedAt: null,
    mealPlanId: PLAN_ID,
    date,
    mealSlot: "dinner",
    recipeId,
    freeformMeal: recipeId ? null : "Leftovers",
    servings: 4,
    attendees: [],
    scaleFactor: 1,
    prepAheadNotes: null,
    leftoverSourceId: null,
  };
}

describe("PlanService.getMealPlanWithEntries", () => {
  it("does not present a deleted recipe as a live dinner", async () => {
    const service = new PlanService({} as never);
    vi.spyOn(service, "getMealPlan").mockResolvedValue(planRow());
    vi.spyOn(service, "getMealPlanEntries").mockResolvedValue([
      entry(GONE, "2026-10-13"),
      entry(null, "2026-10-14"),
      entry(PESTO, "2026-10-15"),
    ]);
    vi.spyOn(service, "getRecipeTitle").mockImplementation(async (id) =>
      id === PESTO ? "Pesto pasta" : null
    );

    const detail = await service.getMealPlanWithEntries(PLAN_ID);

    expect(detail?.entries.map((row) => row.recipeId)).toEqual([null, PESTO]);
    expect(detail?.entries.some((row) => row.recipeId === GONE)).toBe(false);
  });
});
