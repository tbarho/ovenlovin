import { beforeEach, describe, expect, it, vi } from "vitest";
import { authenticateRequest, requireWriteRole } from "./index";

const householdId = "22222222-2222-4222-8222-222222222222";
const dbUserId = "11111111-1111-4111-8111-111111111111";
const clerkUserId = "user_clerk_abc";
const orgId = "org_123";

const fixtures = vi.hoisted(() => ({
  role: "member" as "member" | "viewer" | undefined,
}));

vi.mock("@clerk/backend", () => ({
  verifyToken: vi.fn(async () => ({
    sub: clerkUserId,
    org_id: orgId,
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
        return { id: householdId };
      }
      async getUserByClerkId() {
        return fixtures.role === undefined ? null : { id: dbUserId };
      }
      async getMembershipsForUser() {
        if (!fixtures.role) return [];
        return [{ householdId, role: fixtures.role }];
      }
    },
  };
});

describe("Clerk Bearer kitchen role", () => {
  beforeEach(() => {
    process.env.CLERK_SECRET_KEY = "sk_test";
    fixtures.role = "member";
  });

  it("lets org_role org:member write when the DB row is member", async () => {
    const context = await authenticateRequest({
      Authorization: "Bearer eyJhbGciOiJIUzI1NiJ9.e30.sig",
    });
    expect(context).toMatchObject({
      householdId,
      userId: dbUserId,
      membershipRole: "member",
    });
    expect(() => requireWriteRole(context)).not.toThrow();
  });

  it("forbids writes when the DB row is viewer, even if org_role is org:member", async () => {
    fixtures.role = "viewer";
    const context = await authenticateRequest({
      Authorization: "Bearer eyJhbGciOiJIUzI1NiJ9.e30.sig",
    });
    expect(context.membershipRole).toBe("viewer");
    try {
      requireWriteRole(context);
      expect.fail("expected forbidden");
    } catch (error) {
      expect(error).toMatchObject({ code: "forbidden" });
    }
  });

  it("rejects a Clerk token with no kitchen membership", async () => {
    fixtures.role = undefined;
    await expect(
      authenticateRequest({ Authorization: "Bearer eyJhbGciOiJIUzI1NiJ9.e30.sig" })
    ).rejects.toMatchObject({
      code: "unauthorized",
      message: "Household membership required",
    });
  });
});
