import { describe, expect, it } from "vitest";
import type { Membership } from "@ovenlovin/core";
import { resolveSandboxSession } from "./resolve-kitchen";

const ownKitchen = "11111111-1111-4111-8111-111111111111";
const joinedKitchen = "22222222-2222-4222-8222-222222222222";
const sandbox = {
  userId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  clerkUserId: "user_demo_parent_b",
  householdId: ownKitchen,
};

function membership(
  overrides: Partial<Membership> & { householdId: string; id: string; createdAt: string }
): Membership {
  return {
    updatedAt: overrides.createdAt,
    deletedAt: null,
    userId: sandbox.userId,
    role: "member",
    ...overrides,
  };
}

describe("resolveSandboxSession", () => {
  const own = membership({
    id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    householdId: ownKitchen,
    role: "owner",
    createdAt: "2026-01-01T00:00:00.000Z",
  });
  const joined = membership({
    id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    householdId: joinedKitchen,
    role: "member",
    createdAt: "2026-10-17T00:00:00.000Z",
  });

  it("switches to a joined kitchen when the household cookie asks for it", () => {
    const session = resolveSandboxSession({
      sandbox,
      memberships: [own, joined],
      preferredHouseholdId: joinedKitchen,
    });
    expect(session.householdId).toBe(joinedKitchen);
    expect(session.membershipRole).toBe("member");
    expect(session.userId).toBe(sandbox.userId);
  });

  it("keeps the sandbox pin when no preferred kitchen matches a membership", () => {
    const session = resolveSandboxSession({
      sandbox,
      memberships: [own, joined],
      preferredHouseholdId: "33333333-3333-4333-8333-333333333333",
    });
    expect(session.householdId).toBe(ownKitchen);
    expect(session.membershipRole).toBe("owner");
  });

  it("falls back to the sandbox kitchen when the visitor has no memberships yet", () => {
    const session = resolveSandboxSession({
      sandbox,
      memberships: [],
      preferredHouseholdId: joinedKitchen,
    });
    expect(session.householdId).toBe(ownKitchen);
    expect(session.membershipRole).toBe("owner");
  });
});
