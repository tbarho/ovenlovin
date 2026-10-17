import { describe, expect, it } from "vitest";
import { HOUSEHOLD_COOKIE, INVITE_COOKIE } from "./kitchen-cookies";
import { readKitchenCookies } from "./kitchen-selection";

describe("readKitchenCookies", () => {
  it("reads a selected kitchen and a pending invite token", () => {
    const householdId = "22222222-2222-4222-8222-222222222222";
    const token = "olinv_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
    const store = {
      get(name: string) {
        if (name === HOUSEHOLD_COOKIE) return { value: householdId };
        if (name === INVITE_COOKIE) return { value: token };
        return undefined;
      },
    };
    expect(readKitchenCookies(store)).toEqual({
      preferredHouseholdId: householdId,
      inviteToken: token,
    });
  });

  it("ignores invalid cookie values", () => {
    const store = {
      get(name: string) {
        if (name === HOUSEHOLD_COOKIE) return { value: "not-a-household" };
        if (name === INVITE_COOKIE) return { value: "rkapi_secret" };
        return undefined;
      },
    };
    expect(readKitchenCookies(store)).toEqual({
      preferredHouseholdId: null,
      inviteToken: null,
    });
    expect(readKitchenCookies(null)).toEqual({
      preferredHouseholdId: null,
      inviteToken: null,
    });
  });
});
