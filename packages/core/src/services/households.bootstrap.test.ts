import { describe, expect, it, vi, beforeEach } from "vitest";
import { HouseholdService } from "./households";

function chain(result: unknown[]) {
  const self = {
    from: vi.fn(() => self),
    where: vi.fn(() => self),
    limit: vi.fn(async () => result),
    values: vi.fn(() => self),
    returning: vi.fn(async () => result),
    then: (resolve: (value: unknown) => void) => resolve(result),
  };
  return self;
}

describe("HouseholdService.ensureHouseholdForClerkUser", () => {
  const db = {
    select: vi.fn(),
    insert: vi.fn(),
  };
  const service = new HouseholdService(db as never);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a user, household, and owner membership on first sign-in", async () => {
    const userRow = {
      id: "11111111-1111-4111-8111-111111111111",
      createdAt: new Date("2026-01-01"),
      updatedAt: new Date("2026-01-01"),
      deletedAt: null,
      clerkUserId: "user_abc",
      email: "parent@example.com",
      displayName: "Parent A",
    };
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
});
