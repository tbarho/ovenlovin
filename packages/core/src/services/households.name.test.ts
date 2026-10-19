import { describe, expect, it, vi, beforeEach } from "vitest";
import { HouseholdAccessError } from "./kitchen-access";
import { HouseholdService } from "./households";

function chain(result: unknown[]) {
  const self = {
    from: vi.fn(() => self),
    where: vi.fn(() => self),
    limit: vi.fn(async () => result),
    values: vi.fn(() => self),
    set: vi.fn(() => self),
    returning: vi.fn(async () => result),
    innerJoin: vi.fn(() => self),
    then: (resolve: (value: unknown) => void) => resolve(result),
  };
  return self;
}

const householdRow = {
  id: "22222222-2222-4222-8222-222222222222",
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-01-01"),
  deletedAt: null,
  createdBy: "11111111-1111-4111-8111-111111111111",
  name: "Parent A Kitchen",
  slug: "parent-a-kitchen",
  clerkOrgId: null,
  defaultServingsMode: "family",
  defaultServingsCount: null,
};

describe("HouseholdService.updateHouseholdName", () => {
  const db = {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
  };
  const service = new HouseholdService(db as never);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("lets the owner rename the kitchen", async () => {
    db.update.mockReturnValueOnce(chain([{ ...householdRow, name: "Weeknight kitchen" }]));

    const updated = await service.updateHouseholdName({
      householdId: householdRow.id,
      name: "  Weeknight kitchen  ",
      actorRole: "owner",
    });
    expect(updated.name).toBe("Weeknight kitchen");
    expect(db.update).toHaveBeenCalled();
  });

  it("blocks members from renaming", async () => {
    await expect(
      service.updateHouseholdName({
        householdId: householdRow.id,
        name: "Stolen name",
        actorRole: "member",
      })
    ).rejects.toBeInstanceOf(HouseholdAccessError);
    expect(db.update).not.toHaveBeenCalled();
  });
});
