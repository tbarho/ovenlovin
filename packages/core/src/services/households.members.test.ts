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

const owner = {
  id: "33333333-3333-4333-8333-333333333333",
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-01-01"),
  deletedAt: null,
  userId: "11111111-1111-4111-8111-111111111111",
  householdId: "22222222-2222-4222-8222-222222222222",
  role: "owner" as const,
};

const member = {
  id: "44444444-4444-4444-8444-444444444444",
  createdAt: new Date("2026-02-01"),
  updatedAt: new Date("2026-02-01"),
  deletedAt: null,
  userId: "99999999-9999-4999-8999-999999999999",
  householdId: owner.householdId,
  role: "member" as const,
};

describe("HouseholdService member management", () => {
  const db = {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
  };
  const service = new HouseholdService(db as never);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("lets the owner change a member role", async () => {
    db.select.mockReturnValueOnce(chain([owner, member]));
    db.update.mockReturnValueOnce(chain([{ ...member, role: "admin" }]));

    const updated = await service.updateMemberRole({
      householdId: owner.householdId,
      targetUserId: member.userId,
      role: "admin",
      actorUserId: owner.userId,
      actorRole: "owner",
    });
    expect(updated.role).toBe("admin");
  });

  it("blocks admins and members from changing roles", async () => {
    await expect(
      service.updateMemberRole({
        householdId: owner.householdId,
        targetUserId: member.userId,
        role: "viewer",
        actorUserId: member.userId,
        actorRole: "admin",
      })
    ).rejects.toBeInstanceOf(HouseholdAccessError);
  });

  it("will not demote or remove the last owner", async () => {
    db.select.mockReturnValueOnce(chain([owner, member]));
    await expect(
      service.updateMemberRole({
        householdId: owner.householdId,
        targetUserId: owner.userId,
        role: "member",
        actorUserId: owner.userId,
        actorRole: "owner",
      })
    ).rejects.toThrow(/last owner cannot be demoted/);

    await expect(
      service.removeMember({
        householdId: owner.householdId,
        targetUserId: owner.userId,
        actorUserId: owner.userId,
        actorRole: "owner",
      })
    ).rejects.toThrow(/Use leave/);

    db.select.mockReturnValueOnce(chain([owner]));
    await expect(
      service.removeMember({
        householdId: owner.householdId,
        targetUserId: owner.userId,
        actorUserId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        actorRole: "owner",
      })
    ).rejects.toThrow(/last owner cannot be removed/);

    db.select.mockReturnValueOnce(chain([owner]));
    await expect(
      service.leaveHousehold({ householdId: owner.householdId, userId: owner.userId })
    ).rejects.toThrow(/last owner cannot leave/);
  });

  it("lets the owner remove Parent B and lets a member leave", async () => {
    db.select.mockReturnValueOnce(chain([owner, member]));
    db.update.mockReturnValueOnce(chain([{ ...member, deletedAt: new Date() }]));
    await service.removeMember({
      householdId: owner.householdId,
      targetUserId: member.userId,
      actorUserId: owner.userId,
      actorRole: "owner",
    });
    expect(db.update).toHaveBeenCalled();

    db.select.mockReturnValueOnce(chain([owner, member]));
    db.update.mockReturnValueOnce(chain([{ ...member, deletedAt: new Date() }]));
    await service.leaveHousehold({ householdId: owner.householdId, userId: member.userId });
    expect(db.update).toHaveBeenCalledTimes(2);
  });
});
