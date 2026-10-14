import { describe, expect, it } from "vitest";
import { extractApiKeyFromAuthHeader } from "./index";

describe("extractApiKeyFromAuthHeader", () => {
  it("reads Authorization: ApiKey rkapi_…", () => {
    expect(extractApiKeyFromAuthHeader("ApiKey rkapi_abc")).toBe("rkapi_abc");
  });

  it("reads Authorization: Bearer rkapi_… so MCP clients can use the REST style", () => {
    expect(extractApiKeyFromAuthHeader("Bearer rkapi_deadbeef")).toBe("rkapi_deadbeef");
  });

  it("is case-insensitive on the ApiKey scheme", () => {
    expect(extractApiKeyFromAuthHeader("apikey rkapi_xyz")).toBe("rkapi_xyz");
  });

  it("does not treat a Clerk JWT Bearer token as an API key", () => {
    expect(extractApiKeyFromAuthHeader("Bearer eyJhbGciOiJIUzI1NiJ9.abc")).toBeNull();
  });

  it("returns null for an empty key", () => {
    expect(extractApiKeyFromAuthHeader("ApiKey ")).toBeNull();
    expect(extractApiKeyFromAuthHeader("")).toBeNull();
  });
});
