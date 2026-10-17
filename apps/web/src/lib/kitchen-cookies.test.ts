import { describe, expect, it } from "vitest";
import { isHouseholdId, readInviteToken } from "./kitchen-cookies";

describe("kitchen cookies", () => {
  it("accepts a household uuid and an invite token", () => {
    expect(isHouseholdId("22222222-2222-4222-8222-222222222222")).toBe(true);
    expect(isHouseholdId("not-a-household")).toBe(false);
    expect(readInviteToken("olinv_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa")).toBe(
      "olinv_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
    );
    expect(readInviteToken("rkapi_secret")).toBeNull();
  });
});
