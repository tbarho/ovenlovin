import { describe, expect, it } from "vitest";
import {
  mealPlanEntryWriteFromRow,
  planMealPlanEntryMerge,
  planPatchesToWrites,
  resolveMealPlanEntryPatch,
} from "./merge-entries";
import type { MealPlanEntry } from "../schemas/plans";

const recipeA = "550e8400-e29b-41d4-a716-446655440010";
const recipeB = "550e8400-e29b-41d4-a716-446655440011";

function entry(
  overrides: Partial<MealPlanEntry> & { date: string; mealSlot: string }
): MealPlanEntry {
  return {
    id: overrides.id ?? "entry-1",
    createdAt: "2026-10-12T00:00:00.000Z",
    updatedAt: "2026-10-12T00:00:00.000Z",
    deletedAt: null,
    mealPlanId: "plan-1",
    recipeId: overrides.recipeId ?? recipeA,
    freeformMeal: overrides.freeformMeal ?? null,
    servings: overrides.servings ?? 4,
    attendees: overrides.attendees ?? [],
    scaleFactor: 1,
    prepAheadNotes: overrides.prepAheadNotes ?? null,
    leftoverSourceId: null,
    ...overrides,
  };
}

describe("planMealPlanEntryMerge", () => {
  const monday = entry({ id: "mon", date: "2026-10-12", mealSlot: "dinner" });
  const tuesday = entry({
    id: "tue",
    date: "2026-10-13",
    mealSlot: "dinner",
    recipeId: recipeB,
  });

  it("editing Monday leaves Tuesday and Wednesday untouched", () => {
    const wednesday = entry({
      id: "wed",
      date: "2026-10-14",
      mealSlot: "dinner",
      recipeId: recipeB,
    });
    const week = [monday, tuesday, wednesday];
    const afterMonday = planMealPlanEntryMerge(week, [
      { date: "2026-10-12", meal: "dinner", recipeId: recipeB, servings: 4 },
    ]);
    expect(afterMonday.upserts).toHaveLength(1);
    expect(afterMonday.upserts[0]?.next.date).toBe("2026-10-12");
    expect(afterMonday.clearIds).toEqual([]);
    expect(week.find((row) => row.date === "2026-10-13")?.recipeId).toBe(recipeB);
    expect(week.find((row) => row.date === "2026-10-14")?.recipeId).toBe(recipeB);
  });

  it("upserts one night and leaves the rest of the week", () => {
    const result = planMealPlanEntryMerge(
      [monday, tuesday],
      [{ date: "2026-10-13", meal: "dinner", recipeId: recipeA, servings: 2 }]
    );
    expect(result.clearIds).toEqual([]);
    expect(result.previous.map((row) => row.id)).toEqual(["tue"]);
    expect(result.upserts).toHaveLength(1);
    expect(result.upserts[0]?.next).toMatchObject({
      date: "2026-10-13",
      meal: "dinner",
      recipeId: recipeA,
      servings: 2,
    });
  });

  it("clears a night without dropping other days", () => {
    const result = planMealPlanEntryMerge(
      [monday, tuesday],
      [{ date: "2026-10-12", meal: "dinner", clear: true }]
    );
    expect(result.clearIds).toEqual(["mon"]);
    expect(result.upserts).toEqual([]);
    expect(result.previous[0]?.id).toBe("mon");
  });

  it("adds a new night", () => {
    const result = planMealPlanEntryMerge(
      [monday],
      [{ date: "2026-10-14", meal: "dinner", freeformMeal: "Leftovers", servings: 3 }]
    );
    expect(result.previous).toEqual([]);
    expect(result.upserts[0]?.existing).toBeUndefined();
    expect(result.upserts[0]?.next.freeformMeal).toBe("Leftovers");
    expect(result.upserts[0]?.next.servings).toBe(3);
  });
});

describe("resolveMealPlanEntryPatch", () => {
  it("keeps attendees and servings when a swap omits them", () => {
    const current = entry({
      date: "2026-10-12",
      mealSlot: "dinner",
      servings: 6,
      attendees: ["550e8400-e29b-41d4-a716-446655440099"],
    });
    const next = resolveMealPlanEntryPatch(
      { date: "2026-10-12", meal: "dinner", recipeId: recipeB },
      current
    );
    expect(next.recipeId).toBe(recipeB);
    expect(next.servings).toBe(6);
    expect(next.attendees).toEqual(["550e8400-e29b-41d4-a716-446655440099"]);
    expect(next.freeformMeal).toBeUndefined();
  });

  it("clears the recipe when setting a freeform leftovers label", () => {
    const current = entry({ date: "2026-10-16", mealSlot: "dinner" });
    const next = resolveMealPlanEntryPatch(
      { date: "2026-10-16", meal: "dinner", freeformMeal: "TEST Olive leftovers", servings: 2 },
      current
    );
    expect(next.recipeId).toBeUndefined();
    expect(next.freeformMeal).toBe("TEST Olive leftovers");
    expect(next.servings).toBe(2);
  });
});

describe("planPatchesToWrites", () => {
  it("drops clear patches for full-replace mode", () => {
    expect(
      planPatchesToWrites([
        { date: "2026-10-12", meal: "dinner", recipeId: recipeA, attendees: [] },
        { date: "2026-10-13", meal: "dinner", clear: true },
      ])
    ).toHaveLength(1);
  });

  it("round-trips a stored entry to a write payload", () => {
    const write = mealPlanEntryWriteFromRow(
      entry({
        date: "2026-10-12",
        mealSlot: "dinner",
        freeformMeal: "No-cook night",
        recipeId: null,
      })
    );
    expect(write.freeformMeal).toBe("No-cook night");
    expect(write.recipeId).toBeUndefined();
  });
});
