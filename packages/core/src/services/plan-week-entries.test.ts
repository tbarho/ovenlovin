import { describe, expect, it } from "vitest";
import {
  keepLiveRecipeEntries,
  liveEntriesForPlanRead,
  mondayWeekDates,
  pickPlanForWeek,
  planEntriesForWeek,
  toIsoDateOnly,
} from "./plan-week-entries";

function entry(
  overrides: Partial<{
    date: string;
    mealSlot: string;
    createdAt: string;
    updatedAt: string;
    deletedAt: string | null;
    recipeId: string | null;
  }> = {}
) {
  return {
    date: "2026-10-12",
    mealSlot: "dinner",
    createdAt: "2026-10-12T00:00:00.000Z",
    updatedAt: "2026-10-12T00:00:00.000Z",
    deletedAt: null as string | null,
    recipeId: "recipe-a",
    ...overrides,
  };
}

describe("planEntriesForWeek", () => {
  it("keeps breakfast and dinner on the same day", () => {
    const kept = planEntriesForWeek(
      [
        entry({ date: "2026-10-17", mealSlot: "breakfast", recipeId: "pancakes" }),
        entry({ date: "2026-10-17", mealSlot: "dinner", recipeId: "pesto" }),
      ],
      "2026-10-12"
    );
    expect(kept.map((item) => item.recipeId)).toEqual(["pancakes", "pesto"]);
  });

  it("drops a removed dinner and an older duplicate slot", () => {
    const kept = planEntriesForWeek(
      [
        entry({
          date: "2026-10-17",
          recipeId: "pesto",
          createdAt: "2026-10-12T00:00:00.000Z",
          updatedAt: "2026-10-12T00:00:00.000Z",
        }),
        entry({
          date: "2026-10-17",
          recipeId: "tacos",
          createdAt: "2026-10-15T12:00:00.000Z",
          updatedAt: "2026-10-15T12:00:00.000Z",
        }),
        entry({
          date: "2026-10-13",
          recipeId: "gone",
          deletedAt: "2026-10-15T12:00:00.000Z",
        }),
        entry({ date: "2026-09-28", recipeId: "last-month" }),
      ],
      "2026-10-12"
    );
    expect(kept).toHaveLength(1);
    expect(kept[0]?.recipeId).toBe("tacos");
  });

  it("normalizes timestamp dates onto the Monday week", () => {
    expect(toIsoDateOnly("2026-10-17T00:00:00.000Z")).toBe("2026-10-17");
    expect(mondayWeekDates("2026-10-12")).toHaveLength(7);
    const kept = planEntriesForWeek(
      [entry({ date: "2026-10-17T00:00:00.000Z", recipeId: "pesto" })],
      "2026-10-12"
    );
    expect(kept[0]?.date).toBe("2026-10-17");
  });
});

describe("keepLiveRecipeEntries", () => {
  it("drops a deleted recipe night and keeps freeform leftovers", () => {
    const kept = keepLiveRecipeEntries(
      [
        entry({ recipeId: "gone" }),
        entry({ date: "2026-10-13", recipeId: null, mealSlot: "dinner" }),
        entry({ date: "2026-10-14", recipeId: "pesto" }),
      ],
      new Set(["pesto"])
    );
    expect(kept.map((item) => item.date)).toEqual(["2026-10-13", "2026-10-14"]);
  });
});

describe("liveEntriesForPlanRead", () => {
  it("uses keepLiveRecipeEntries after resolving live recipes", async () => {
    const kept = await liveEntriesForPlanRead(
      [
        entry({ recipeId: "gone" }),
        entry({ date: "2026-10-13", recipeId: null, mealSlot: "dinner" }),
        entry({ date: "2026-10-14", recipeId: "pesto" }),
      ],
      async (id) => id === "pesto"
    );
    expect(kept.map((item) => item.date)).toEqual(["2026-10-13", "2026-10-14"]);
  });
});

describe("pickPlanForWeek", () => {
  it("picks the newest plan when two rows share a week", () => {
    const older = {
      id: "plan-a",
      weekStart: "2027-02-08",
      updatedAt: "2027-02-08T00:00:00.000Z",
    };
    const newer = {
      id: "plan-b",
      weekStart: "2027-02-08",
      updatedAt: "2027-02-09T18:00:00.000Z",
    };
    expect(pickPlanForWeek([older, newer], "2027-02-08")?.id).toBe("plan-b");
    expect(pickPlanForWeek([newer, older], "2027-02-08")?.id).toBe("plan-b");
  });
});
