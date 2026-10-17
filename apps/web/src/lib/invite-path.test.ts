import { describe, expect, it } from "vitest";
import { inviteTokenFromPathname } from "./invite-path";

describe("inviteTokenFromPathname", () => {
  it("reads a valid invite token from the public path", () => {
    const token = "olinv_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
    expect(inviteTokenFromPathname(`/invite/${token}`)).toBe(token);
    expect(inviteTokenFromPathname("/invite/nope")).toBeNull();
    expect(inviteTokenFromPathname("/settings")).toBeNull();
  });
});
