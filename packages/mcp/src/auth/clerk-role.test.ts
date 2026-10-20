import { beforeEach, describe, expect, it, vi } from "vitest";
import { authenticateRequest, requireWriteRole } from "./index";

const kitchenA = "22222222-2222-4222-8222-222222222222";
const kitchenB = "33333333-3333-4333-8333-333333333333";
const foreignKitchen = "44444444-4444-4444-8444-444444444444";
const dbUserId = "11111111-1111-4111-8111-111111111111";
const clerkUserId = "user_clerk_abc";
const bearer = { Authorization: "Bearer eyJhbGciOiJIUzI1NiJ9.e30.sig" };

const fixtures = vi.hoisted(() => ({
  orgId: undefined as string | undefined,
  user: { id: "11111111-1111-4111-8111-111111111111" } as { id: string } | null,
  orgHouseholdId: undefined as string | undefined,
  memberships: [] as Array<{
    id: string;
    createdAt: string;
    householdId: string;
    role: "owner" | "admin" | "member" | "viewer";
    userId: string;
  }>,
}));

function membership(
  householdId: string,
  role: "owner" | "admin" | "member" | "viewer",
  id: string,
  createdAt: string
) {
  return { id, createdAt, householdId, role, userId: dbUserId };
}

vi.mock("@clerk/backend", () => ({
  verifyToken: vi.fn(async () => ({
    sub: clerkUserId,
    org_id: fixtures.orgId,
    org_role: "org:member",
  })),
}));

vi.mock("@ovenlovin/db", () => ({
  getDatabase: () => ({}),
}));

vi.mock("@ovenlovin/core", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@ovenlovin/core")>();
  return {
    ...actual,
    HouseholdService: class {
      async getHouseholdByClerkOrgId() {
        return fixtures.orgHouseholdId ? { id: fixtures.orgHouseholdId } : null;
      }
      async getUserByClerkId() {
        return fixtures.user;
      }
      async getMembershipsForUser() {
        return fixtures.memberships;
      }
    },
  };
});

describe("Clerk Bearer kitchen role", () => {
  beforeEach(() => {
    process.env.CLERK_SECRET_KEY = "sk_test";
    fixtures.orgId = undefined;
    fixtures.user = { id: dbUserId };
    fixtures.orgHouseholdId = undefined;
    fixtures.memberships = [membership(kitchenA, "member", "mem_a", "2026-01-01T00:00:00.000Z")];
  });

  it("lets org_role org:member write when the DB row is member", async () => {
    fixtures.orgId = "org_123";
    fixtures.orgHouseholdId = kitchenA;
    const context = await authenticateRequest(bearer);
    expect(context).toMatchObject({
      householdId: kitchenA,
      userId: dbUserId,
      membershipRole: "member",
    });
    expect(() => requireWriteRole(context)).not.toThrow();
  });

  it("forbids writes when the DB row is viewer, even if org_role is org:member", async () => {
    fixtures.memberships = [membership(kitchenA, "viewer", "mem_a", "2026-01-01T00:00:00.000Z")];
    const context = await authenticateRequest(bearer);
    expect(context.membershipRole).toBe("viewer");
    try {
      requireWriteRole(context);
      expect.fail("expected forbidden");
    } catch (error) {
      expect(error).toMatchObject({ code: "forbidden" });
    }
  });

  it("rejects a Clerk token with no kitchen membership", async () => {
    fixtures.memberships = [];
    await expect(authenticateRequest(bearer)).rejects.toMatchObject({
      code: "unauthorized",
      message: "Open OvenLovin once in the browser to set up your kitchen, or use an API key.",
    });
  });

  it("accepts a Clerk token with no org_id when the user has one membership", async () => {
    const context = await authenticateRequest(bearer);
    expect(context).toMatchObject({
      householdId: kitchenA,
      userId: dbUserId,
      membershipRole: "member",
    });
  });

  it("keeps MCP writes on the oldest kitchen after joining another", async () => {
    fixtures.memberships = [
      membership(kitchenA, "owner", "mem_a", "2026-01-01T00:00:00.000Z"),
      membership(kitchenB, "member", "mem_b", "2026-02-01T00:00:00.000Z"),
    ];
    const context = await authenticateRequest(bearer);
    expect(context).toMatchObject({
      householdId: kitchenA,
      userId: dbUserId,
      membershipRole: "owner",
    });
    expect(context.scopes).toContain("recipes:write");
    expect(context.scopes).toContain("plans:write");
    expect(() => requireWriteRole(context)).not.toThrow();
  });

  it("picks X-Kitchen-Id when the user has two memberships and no org_id", async () => {
    fixtures.memberships = [
      membership(kitchenA, "member", "mem_a", "2026-01-01T00:00:00.000Z"),
      membership(kitchenB, "admin", "mem_b", "2026-02-01T00:00:00.000Z"),
    ];
    const context = await authenticateRequest({
      ...bearer,
      "X-Kitchen-Id": kitchenB,
    });
    expect(context).toMatchObject({
      householdId: kitchenB,
      membershipRole: "admin",
    });
  });

  it("rejects X-Kitchen-Id for a kitchen the user does not belong to", async () => {
    await expect(
      authenticateRequest({
        ...bearer,
        "X-Kitchen-Id": foreignKitchen,
      })
    ).rejects.toMatchObject({
      code: "unauthorized",
      message: "You are not a member of that kitchen. Check X-Kitchen-Id.",
    });
  });

  it("lets X-Kitchen-Id win when org_id maps to a different kitchen", async () => {
    fixtures.orgId = "org_123";
    fixtures.orgHouseholdId = kitchenA;
    fixtures.memberships = [
      membership(kitchenA, "member", "mem_a", "2026-01-01T00:00:00.000Z"),
      membership(kitchenB, "admin", "mem_b", "2026-02-01T00:00:00.000Z"),
    ];
    const context = await authenticateRequest({
      ...bearer,
      "X-Kitchen-Id": kitchenB,
    });
    expect(context).toMatchObject({
      householdId: kitchenB,
      membershipRole: "admin",
    });
  });
});
