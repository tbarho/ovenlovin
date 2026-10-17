import { describe, expect, it } from "vitest";
import { UnauthorizedError } from "./errors";
import { requireUserId, requireUserOrKeyOwner } from "./middleware";

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
