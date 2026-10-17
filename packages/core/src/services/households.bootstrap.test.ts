import { describe, expect, it, vi, beforeEach } from "vitest";
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

describe("HouseholdService.ensureHouseholdForClerkUser", () => {
  const db = {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
  };
  const service = new HouseholdService(db as never);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  const userRow = {
    id: "11111111-1111-4111-8111-111111111111",
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
    deletedAt: null,
    clerkUserId: "user_abc",
    email: "parent@example.com",
    displayName: "Parent A",
  };

  it("creates a user, household, and owner membership on first sign-in", async () => {
    const householdRow = {
      id: "22222222-2222-4222-8222-222222222222",
      createdAt: new Date("2026-01-01"),
      updatedAt: new Date("2026-01-01"),
      deletedAt: null,
      createdBy: userRow.id,
      name: "Parent A Kitchen",
      slug: "kitchen-1111111111114111",
      clerkOrgId: null,
    };
    const membershipRow = {
      id: "33333333-3333-4333-8333-333333333333",
      createdAt: new Date("2026-01-01"),
      updatedAt: new Date("2026-01-01"),
      deletedAt: null,
      userId: userRow.id,
      householdId: householdRow.id,
      role: "owner",
    };

    db.select.mockReturnValueOnce(chain([])).mockReturnValueOnce(chain([]));
    db.insert
      .mockReturnValueOnce(chain([userRow]))
      .mockReturnValueOnce(chain([householdRow]))
      .mockReturnValueOnce(chain([membershipRow]));

    const result = await service.ensureHouseholdForClerkUser({
      clerkUserId: "user_abc",
      email: "parent@example.com",
      displayName: "Parent A",
    });

    expect(result.created).toBe(true);
    expect(result.user.clerkUserId).toBe("user_abc");
    expect(result.household.name).toBe("Parent A Kitchen");
    expect(result.membership.role).toBe("owner");
  });

  it("joins an existing Clerk org household as member, not owner", async () => {
    const spouse = {
      ...userRow,
      clerkUserId: "user_spouse",
      email: "parent-b@example.com",
      displayName: "Parent B",
    };
    const householdRow = {
      id: "22222222-2222-4222-8222-222222222222",
      createdAt: new Date("2026-01-01"),
      updatedAt: new Date("2026-01-01"),
      deletedAt: null,
      createdBy: "00000000-0000-4000-8000-000000000000",
      name: "Parent A Kitchen",
      slug: "kitchen-parent-a",
      clerkOrgId: "org_family",
    };
    const membershipRow = {
      id: "33333333-3333-4333-8333-333333333333",
      createdAt: new Date("2026-01-01"),
      updatedAt: new Date("2026-01-01"),
      deletedAt: null,
      userId: spouse.id,
      householdId: householdRow.id,
      role: "member",
    };

    db.select
      .mockReturnValueOnce(chain([]))
      .mockReturnValueOnce(chain([householdRow]))
      .mockReturnValueOnce(chain([]))
      .mockReturnValueOnce(chain([membershipRow]))
      .mockReturnValueOnce(chain([householdRow]));
    db.insert.mockReturnValueOnce(chain([spouse])).mockReturnValueOnce(chain([membershipRow]));

    const result = await service.ensureHouseholdForClerkUser({
      clerkUserId: "user_spouse",
      email: "parent-b@example.com",
      displayName: "Parent B",
      clerkOrgId: "org_family",
    });

    expect(result.created).toBe(false);
    expect(result.household.id).toBe(householdRow.id);
    expect(result.membership.role).toBe("member");
    const membershipInsert = db.insert.mock.results[1]?.value as {
      values: { mock: { calls: Array<[Record<string, unknown>]> } };
    };
    expect(membershipInsert.values.mock.calls[0]?.[0]).toMatchObject({
      userId: spouse.id,
      householdId: householdRow.id,
      role: "member",
    });
  });

  it("joins a pending invite kitchen instead of creating an empty one", async () => {
    const spouse = {
      ...userRow,
      clerkUserId: "user_spouse",
      email: "parent-b@example.com",
      displayName: "Parent B",
    };
    const invitedHousehold = {
      id: "22222222-2222-4222-8222-222222222222",
      createdAt: new Date("2026-01-01"),
      updatedAt: new Date("2026-01-01"),
      deletedAt: null,
      createdBy: "00000000-0000-4000-8000-000000000000",
      name: "Parent A Kitchen",
      slug: "kitchen-parent-a",
      clerkOrgId: null,
    };
    const membershipRow = {
      id: "33333333-3333-4333-8333-333333333333",
      createdAt: new Date("2026-01-01"),
      updatedAt: new Date("2026-01-01"),
      deletedAt: null,
      userId: spouse.id,
      householdId: invitedHousehold.id,
      role: "member",
    };

    db.select
      .mockReturnValueOnce(chain([]))
      .mockReturnValueOnce(chain([invitedHousehold]))
      .mockReturnValueOnce(chain([]));
    db.insert.mockReturnValueOnce(chain([spouse])).mockReturnValueOnce(chain([membershipRow]));

    const result = await service.ensureHouseholdForClerkUser({
      clerkUserId: "user_spouse",
      email: "parent-b@example.com",
      displayName: "Parent B",
      pendingInvite: { householdId: invitedHousehold.id, role: "member" },
    });

    expect(result.created).toBe(true);
    expect(result.household.id).toBe(invitedHousehold.id);
    expect(result.household.name).toBe("Parent A Kitchen");
    expect(result.membership.role).toBe("member");
    expect(db.insert).toHaveBeenCalledTimes(2);
  });

  it("selects a preferred kitchen when the user already has more than one", async () => {
    const firstHousehold = {
      id: "22222222-2222-4222-8222-222222222222",
      createdAt: new Date("2026-01-01"),
      updatedAt: new Date("2026-01-01"),
      deletedAt: null,
      createdBy: userRow.id,
      name: "Parent A Kitchen",
      slug: "kitchen-parent-a",
      clerkOrgId: null,
    };
    const secondHousehold = {
      ...firstHousehold,
      id: "44444444-4444-4444-8444-444444444444",
      name: "Weekend Cabin",
      slug: "kitchen-cabin",
    };
    const firstMembership = {
      id: "33333333-3333-4333-8333-333333333333",
      createdAt: new Date("2026-01-01"),
      updatedAt: new Date("2026-01-01"),
      deletedAt: null,
      userId: userRow.id,
      householdId: firstHousehold.id,
      role: "owner",
    };
    const secondMembership = {
      ...firstMembership,
      id: "55555555-5555-4555-8555-555555555555",
      createdAt: new Date("2026-02-01"),
      householdId: secondHousehold.id,
      role: "member",
    };

    db.select
      .mockReturnValueOnce(chain([userRow]))
      .mockReturnValueOnce(chain([firstMembership, secondMembership]))
      .mockReturnValueOnce(chain([secondHousehold]));

    const result = await service.ensureHouseholdForClerkUser({
      clerkUserId: "user_abc",
      email: "parent@example.com",
      displayName: "Parent A",
      preferredHouseholdId: secondHousehold.id,
    });

    expect(result.created).toBe(false);
    expect(result.household.id).toBe(secondHousehold.id);
    expect(result.membership.role).toBe("member");
  });
});
