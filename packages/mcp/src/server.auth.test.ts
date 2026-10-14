import { describe, expect, it } from "vitest";
import { resolveAuthContext } from "./server";

describe("resolveAuthContext", () => {
  it("uses the request-scoped auth so tools see the key-derived household", () => {
    expect(
      resolveAuthContext({
        auth: {
          householdId: "hh_sandbox",
          apiKeyId: "key_1",
          scopes: ["recipes:read"],
        },
      })
    ).toEqual({
      householdId: "hh_sandbox",
      apiKeyId: "key_1",
      scopes: ["recipes:read"],
    });
  });

  it("falls back to the historical stub when callers omit auth (stdio / unit tests)", () => {
    expect(resolveAuthContext().householdId).toBe("stub");
  });
});
