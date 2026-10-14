import { beforeEach, describe, expect, it, vi } from "vitest";
import { ScheduleService } from "./schedule";

function chain(result: unknown[]) {
  const self = {
    from: vi.fn(() => self),
    where: vi.fn(() => self),
    limit: vi.fn(() => self),
    orderBy: vi.fn(() => self),
    values: vi.fn(() => self),
    set: vi.fn(() => self),
    innerJoin: vi.fn(() => self),
    leftJoin: vi.fn(() => self),
    then: (resolve: (value: unknown) => void) => resolve(result),
  };
  return self;
}

describe("ScheduleService", () => {
  const db = {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
  };
  const service = new ScheduleService(db as never);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the default week when the household has no template rows", async () => {
    db.select.mockReturnValueOnce(chain([])).mockReturnValueOnce(chain([]));
    const schedule = await service.getSchedule("00000000-0000-4000-8000-000000000001");
    expect(schedule.weeklyTemplate).toHaveLength(7);
    expect(schedule.weeklyTemplate[5]).toMatchObject({
      day: "friday",
      busyLevel: "high",
      cooking: false,
    });
    expect(schedule.overrides).toEqual([]);
  });

  it("maps past meal-plan entries to recentMeals", async () => {
    db.select.mockReturnValueOnce(
      chain([
        {
          date: "2026-10-13",
          meal: "dinner",
          recipeTitle: "Weeknight pesto pasta",
          freeformMeal: null,
        },
      ])
    );
    const meals = await service.listRecentMeals(
      "00000000-0000-4000-8000-000000000001",
      14,
      new Date("2026-10-14T12:00:00.000Z")
    );
    expect(meals).toEqual([
      { date: "2026-10-13", meal: "dinner", recipeTitle: "Weeknight pesto pasta" },
    ]);
  });
});
