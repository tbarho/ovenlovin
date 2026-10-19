import { describe, expect, it } from "vitest";
import { ForbiddenError, UnauthorizedError } from "./errors";
import {
  apiKeyMembershipRole,
  requireAdminRole,
  requireOwnerRole,
  requireUserId,
  requireUserOrKeyOwner,
} from "./middleware";

describe("invite actor helpers", () => {
  it("lets an API key create invites as the key owner, but not accept them", () => {
    const apiKeyContext = {
      isBot: true,
      householdId: "22222222-2222-4222-8222-222222222222",
      apiKeyCreatedBy: "11111111-1111-4111-8111-111111111111",
      clientId: "33333333-3333-4333-8333-333333333333",
    };

    expect(requireUserOrKeyOwner(apiKeyContext)).toBe(apiKeyContext.apiKeyCreatedBy);
    expect(() => requireUserId(apiKeyContext)).toThrow(UnauthorizedError);
  });

  it("uses the signed-in user when both a session and a key owner are present", () => {
    expect(
      requireUserOrKeyOwner({
        userId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        apiKeyCreatedBy: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      })
    ).toBe("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
  });

  it("rejects a key with no owning user", () => {
    expect(() => requireUserOrKeyOwner({ isBot: true, clientId: "key" })).toThrow(
      UnauthorizedError
    );
  });
});

describe("API key kitchen roles", () => {
  const kitchenId = "22222222-2222-4222-8222-222222222222";
  const otherKitchenId = "55555555-5555-4555-8555-555555555555";
  const ownerKey = {
    isBot: true,
    householdId: kitchenId,
    apiKeyCreatedBy: "11111111-1111-4111-8111-111111111111",
    clientId: "33333333-3333-4333-8333-333333333333",
    membershipRole: "owner" as const,
  };
  const adminKey = { ...ownerKey, membershipRole: "admin" as const };

  it("uses the creator's role in this kitchen, not another household", () => {
    expect(
      apiKeyMembershipRole(
        [
          { householdId: otherKitchenId, role: "owner" },
          { householdId: kitchenId, role: "admin" },
        ],
        kitchenId
      )
    ).toBe("admin");
    expect(apiKeyMembershipRole([{ householdId: otherKitchenId, role: "owner" }], kitchenId)).toBe(
      undefined
    );
  });

  it("lets the owner's key rename the kitchen and manage members, and rejects an admin's key", () => {
    expect(() => requireOwnerRole(ownerKey)).not.toThrow();
    expect(() => requireOwnerRole(adminKey)).toThrow(ForbiddenError);
    expect(() => requireAdminRole(adminKey)).not.toThrow();
    expect(() => requireAdminRole({ ...adminKey, membershipRole: "member" })).toThrow(
      ForbiddenError
    );
    expect(() => requireOwnerRole({ isBot: true, clientId: ownerKey.clientId })).toThrow(
      ForbiddenError
    );
  });
});
