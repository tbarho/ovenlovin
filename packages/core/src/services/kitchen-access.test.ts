import { describe, expect, it } from "vitest";
import type { Membership, MembershipRole } from "../schemas/households";
import {
  HouseholdAccessError,
  assertCanManageInvites,
  assertCanManageMembers,
  assertInviteAcceptable,
  assertInviteableRole,
  canManageInvites,
  canManageMembers,
  defaultInviteExpiry,
  invitePath,
  inviteNeedsSignedInUserMessage,
  API_KEY_CANNOT_SWITCH_KITCHEN_MESSAGE,
  inviteStatus,
  isInviteToken,
  isSoleOwner,
  preferredKitchenId,
  selectActiveMembership,
} from "./kitchen-access";

function membership(
  overrides: Partial<Membership> & { householdId: string; id: string; createdAt: string }
): Membership {
  return {
    updatedAt: overrides.createdAt,
    deletedAt: null,
    userId: "11111111-1111-4111-8111-111111111111",
    role: "member",
    ...overrides,
  };
}

describe("kitchen access policy", () => {
  it("lets owner and admin manage invites, but not member or viewer", () => {
    expect(canManageInvites("owner")).toBe(true);
    expect(canManageInvites("admin")).toBe(true);
    expect(canManageInvites("member")).toBe(false);
    expect(canManageInvites("viewer")).toBe(false);
    expect(() => assertCanManageInvites("member")).toThrow(HouseholdAccessError);
  });

  it("lets only the owner change members or roles", () => {
    expect(canManageMembers("owner")).toBe(true);
    expect(canManageMembers("admin")).toBe(false);
    expect(canManageMembers("member")).toBe(false);
    expect(() => assertCanManageMembers("admin")).toThrow(/Owner role/);
  });

  it("rejects inviting someone as owner", () => {
    expect(() => assertInviteableRole("owner")).toThrow(/Owner cannot be granted/);
    expect(() => assertInviteableRole("member")).not.toThrow();
  });

  it("detects the sole owner so they cannot leave or be demoted", () => {
    const members = [
      { role: "owner" as MembershipRole, userId: "parent-a" },
      { role: "member" as MembershipRole, userId: "parent-b" },
    ];
    expect(isSoleOwner(members, "parent-a")).toBe(true);
    expect(isSoleOwner(members, "parent-b")).toBe(false);
    expect(isSoleOwner([...members, { role: "owner", userId: "other" }], "parent-a")).toBe(false);
  });

  it("prefers a pending invite kitchen over the last selected kitchen", () => {
    expect(
      preferredKitchenId({
        selectedHouseholdId: "hhhhhhh1-1111-4111-8111-111111111111",
        pendingInviteHouseholdId: "hhhhhhh2-1111-4111-8111-111111111111",
      })
    ).toBe("hhhhhhh2-1111-4111-8111-111111111111");
    expect(
      preferredKitchenId({
        selectedHouseholdId: "hhhhhhh1-1111-4111-8111-111111111111",
      })
    ).toBe("hhhhhhh1-1111-4111-8111-111111111111");
  });

  it("selects a preferred kitchen when the user belongs to it", () => {
    const first = membership({
      id: "aaaaaaa1-1111-4111-8111-111111111111",
      householdId: "hhhhhhh1-1111-4111-8111-111111111111",
      createdAt: "2026-01-01T00:00:00.000Z",
    });
    const second = membership({
      id: "aaaaaaa2-1111-4111-8111-111111111111",
      householdId: "hhhhhhh2-1111-4111-8111-111111111111",
      createdAt: "2026-02-01T00:00:00.000Z",
    });
    expect(selectActiveMembership([second, first], second.householdId)?.id).toBe(second.id);
  });

  it("picks the oldest kitchen deterministically when no preferred id matches", () => {
    const later = membership({
      id: "aaaaaaa2-1111-4111-8111-111111111111",
      householdId: "hhhhhhh2-1111-4111-8111-111111111111",
      createdAt: "2026-02-01T00:00:00.000Z",
    });
    const earlier = membership({
      id: "aaaaaaa1-1111-4111-8111-111111111111",
      householdId: "hhhhhhh1-1111-4111-8111-111111111111",
      createdAt: "2026-01-01T00:00:00.000Z",
    });
    expect(selectActiveMembership([later, earlier], "missing")?.id).toBe(earlier.id);
    expect(selectActiveMembership([later, earlier])?.id).toBe(earlier.id);
  });

  it("classifies invite links as pending, expired, or revoked", () => {
    const now = new Date("2026-10-17T12:00:00.000Z");
    expect(inviteStatus({ expiresAt: "2026-10-18T12:00:00.000Z", now })).toBe("pending");
    expect(inviteStatus({ expiresAt: "2026-10-16T12:00:00.000Z", now })).toBe("expired");
    expect(
      inviteStatus({
        expiresAt: "2026-10-18T12:00:00.000Z",
        revokedAt: "2026-10-17T11:00:00.000Z",
        now,
      })
    ).toBe("revoked");
    expect(() => assertInviteAcceptable({ expiresAt: "2026-10-16T12:00:00.000Z", now })).toThrow(
      /expired/
    );
  });

  it("defaults invite expiry to seven days and clamps to 1-30", () => {
    const now = new Date("2026-10-17T00:00:00.000Z");
    expect(defaultInviteExpiry(now).toISOString()).toBe("2026-10-24T00:00:00.000Z");
    expect(defaultInviteExpiry(now, 1).toISOString()).toBe("2026-10-18T00:00:00.000Z");
    expect(defaultInviteExpiry(now, 99).toISOString()).toBe("2026-11-16T00:00:00.000Z");
  });

  it("recognizes invite tokens and builds the public path", () => {
    const token = "olinv_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
    expect(isInviteToken(token)).toBe(true);
    expect(isInviteToken("not-an-invite")).toBe(false);
    expect(invitePath(token)).toBe(`/invite/${token}`);
  });

  it("tells an API key to have a signed-in person open the invite link", () => {
    const token = "olinv_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
    const message = inviteNeedsSignedInUserMessage("https://kitchen.example", token, true);
    expect(message).toContain(`https://kitchen.example/invite/${token}`);
    expect(message).toMatch(/signed-in person must open/i);
    expect(message).not.toBe("User authentication required");
    expect(API_KEY_CANNOT_SWITCH_KITCHEN_MESSAGE).toMatch(/\/api\/v1\/households\/mine/);
  });
});
