import { afterEach, describe, expect, it, vi } from "vitest";
import { PeopleService } from "./people";
import { PlanService } from "./plans";

const HOUSEHOLD = "22222222-2222-4222-8222-222222222222";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("PeopleService person changes mark plans needsRecheck", () => {
  it("marks current and future plans when a person is added", async () => {
    const mark = vi
      .spyOn(PlanService.prototype, "markCurrentAndFuturePlansNeedRecheck")
      .mockResolvedValue();
    const createdAt = new Date("2026-10-22T00:00:00.000Z");
    const db = {
      select: () => ({
        from: () => ({
          where: async () => [{ next: 0 }],
        }),
      }),
      insert: () => ({
        values: () => ({
          returning: async () => [
            {
              id: "550e8400-e29b-41d4-a716-446655440099",
              createdAt,
              updatedAt: createdAt,
              deletedAt: null,
              createdBy: "user-1",
              householdId: HOUSEHOLD,
              userId: null,
              displayName: "Parent D",
              birthYear: null,
              birthMonth: null,
              sex: null,
              activityProfile: null,
              notes: null,
              sortOrder: 0,
            },
          ],
        }),
      }),
    };
    const people = new PeopleService(db as never);
    await people.createPerson({
      householdId: HOUSEHOLD,
      displayName: "Parent D",
      createdBy: "user-1",
    });
    expect(mark).toHaveBeenCalledWith(HOUSEHOLD);
  });

  it("marks current and future plans when a person is removed", async () => {
    const mark = vi
      .spyOn(PlanService.prototype, "markCurrentAndFuturePlansNeedRecheck")
      .mockResolvedValue();
    const db = {
      transaction: async (fn: (tx: { update: () => unknown }) => Promise<unknown>) =>
        fn({
          update: () => ({
            set: () => ({
              where: () => ({
                returning: async () => [
                  {
                    id: "550e8400-e29b-41d4-a716-446655440099",
                    householdId: HOUSEHOLD,
                  },
                ],
              }),
            }),
          }),
        }),
    };
    const people = new PeopleService(db as never);
    await expect(people.deletePerson("550e8400-e29b-41d4-a716-446655440099")).resolves.toBe(true);
    expect(mark).toHaveBeenCalledWith(HOUSEHOLD);
  });
});
