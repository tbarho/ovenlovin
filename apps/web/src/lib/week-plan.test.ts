import { attendingPeopleForEntry } from "@ovenlovin/allergens";
import { describe, expect, it } from "vitest";
import { testPerson, testPersonRule } from "@/test/fixtures";
import {
  addDays,
  checkMeal,
  findingsFromCheck,
  formatWeekRange,
  groupMealsByDate,
  pickPlanForWeek,
  pickSafety,
  slotLabel,
  startOfWeekMonday,
  weekDates,
} from "./week-plan";
import type { WhoCanEatResult } from "./who-can-eat";

describe("week-plan dates", () => {
  it("snaps Wednesday Oct 14 2026 to Monday Oct 12", () => {
    expect(startOfWeekMonday("2026-10-14")).toBe("2026-10-12");
  });

  it("treats Sunday as the end of the week, not the start", () => {
    expect(startOfWeekMonday("2026-10-18")).toBe("2026-10-12");
  });

  it("builds seven dates from Monday", () => {
    expect(weekDates("2026-10-12")).toEqual([
      "2026-10-12",
      "2026-10-13",
      "2026-10-14",
      "2026-10-15",
      "2026-10-16",
      "2026-10-17",
      "2026-10-18",
    ]);
  });

  it("formats a same-month week range", () => {
    expect(formatWeekRange("2026-10-12")).toBe("Oct 12-18, 2026");
  });

  it("adds days across month boundaries without local TZ drift", () => {
    expect(addDays("2026-10-31", 1)).toBe("2026-11-01");
  });
});

describe("pickPlanForWeek", () => {
  it("picks the newest plan when two rows share a week", () => {
    const older = {
      id: "plan-a",
      weekStart: "2026-10-12",
      updatedAt: "2026-10-12T00:00:00.000Z",
    };
    const newer = {
      id: "plan-b",
      weekStart: "2026-10-12",
      updatedAt: "2026-10-13T18:00:00.000Z",
    };
    expect(pickPlanForWeek([older, newer], "2026-10-12")?.id).toBe("plan-b");
    expect(pickPlanForWeek([newer, older], "2026-10-12")?.id).toBe("plan-b");
    expect(pickPlanForWeek([older, newer], "2026-10-19")).toBeNull();
  });
});

describe("week-plan view", () => {
  it("capitalizes meal slots", () => {
    expect(slotLabel("dinner")).toBe("Dinner");
  });

  it("keeps empty days so the grid is always a full week", () => {
    const days = groupMealsByDate("2026-10-12", [
      {
        entryId: "1",
        date: "2026-10-12",
        mealSlot: "dinner",
        recipeId: "1",
        title: "Weeknight pesto pasta",
        href: "/recipes/1",
        image: null,
        servings: 4,
        isNoCook: false,
        findings: [],
        checkStatus: "complete",
      },
    ]);
    expect(days).toHaveLength(7);
    expect(days[0]?.meals).toHaveLength(1);
    expect(days[1]?.meals).toHaveLength(0);
    expect(days[0]?.weekday).toBe("Monday");
  });

  it("surfaces named per-person findings and never drops a block", () => {
    const check: WhoCanEatResult = {
      status: "complete",
      incompleteReasons: [],
      people: [
        {
          personId: "child-b",
          personName: "Child B",
          mark: "block",
          title: "Child B can't eat this",
          reasons: ["Contains pine nuts, so Child B can't eat this"],
        },
        {
          personId: "parent-a",
          personName: "Parent A",
          mark: "ok",
          title: "Parent A can eat this",
          reasons: ["Nothing in this recipe matches Parent A's rules."],
        },
      ],
    };
    expect(findingsFromCheck(check)).toEqual([
      {
        personName: "Child B",
        severity: "block",
        message: "Contains pine nuts, so Child B can't eat this",
      },
    ]);
  });

  it("checks an unlisted-attendee Monday dinner against Parent A and Child B", () => {
    const parentA = testPerson({ displayName: "Parent A" });
    const childB = testPerson({
      id: "00000000-0000-4000-8000-000000000012",
      displayName: "Child B",
    });
    expect(attendingPeopleForEntry([parentA, childB], [])).toEqual([parentA, childB]);
    expect(attendingPeopleForEntry([], [])).toEqual([]);
  });

  it("does not treat dinner picks as unknown when the kitchen has no people", () => {
    expect(pickSafety([], [], [{ id: "ing-pasta", name: "pasta" }])).toEqual({
      safety: "ok",
      warning: null,
    });
  });

  it("names a dislike in the pre-add warning along with other rules", () => {
    const parentB = testPerson({ displayName: "Parent B" });
    const childC = testPerson({
      id: "00000000-0000-4000-8000-000000000015",
      displayName: "Child C",
    });
    const safety = pickSafety(
      [parentB, childC],
      [
        testPersonRule({ personId: parentB.id, target: "milk", severity: "warn" }),
        testPersonRule({
          personId: childC.id,
          kind: "ingredient",
          target: "olive",
          severity: "prefer_avoid",
        }),
      ],
      [
        { id: "feta", name: "feta cheese" },
        { id: "olives", name: "kalamata olives" },
      ]
    );
    expect(safety.safety).toBe("warn");
    expect(safety.warning).toMatch(/Parent B/);
    expect(safety.warning).toMatch(/Child C/);
    expect(safety.warning).toMatch(/olive/i);
  });

  it("marks a dinner unfinished only when the household has no people", () => {
    const pasta = [{ id: "ing-pasta", name: "pasta" }];
    expect(checkMeal([], [], pasta)).toEqual({ findings: [], checkStatus: "incomplete" });
    const parentA = testPerson({ displayName: "Parent A" });
    const household = attendingPeopleForEntry([parentA], []);
    expect(
      checkMeal(
        household,
        [testPersonRule({ personId: parentA.id, target: "peanut", severity: "block" })],
        pasta
      ).checkStatus
    ).toBe("complete");
  });

  it("rewrites leftover machine codes before they reach the kitchen", () => {
    const check: WhoCanEatResult = {
      status: "complete",
      incompleteReasons: [],
      people: [
        {
          personId: "child-b",
          personName: "Child B",
          mark: "block",
          title: "Child B can't eat this",
          reasons: ['Child B (block: tree_nut). "pesto" contains pine nuts.'],
        },
      ],
    };
    const [finding] = findingsFromCheck(check);
    expect(finding?.message).not.toMatch(/block\s*:/);
    expect(finding?.message).not.toMatch(/tree_nut/);
    expect(finding?.message).toMatch(/Child B/);
  });
});
