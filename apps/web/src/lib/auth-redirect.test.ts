import { describe, expect, it } from "vitest";
import { safeAuthRedirect } from "./auth-redirect";

describe("safeAuthRedirect", () => {
  const token = "olinv_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

  it("allows an invite path and rejects open redirects", () => {
    expect(safeAuthRedirect(`/invite/${token}`)).toBe(`/invite/${token}`);
    expect(safeAuthRedirect("https://evil.example/invite/x")).toBe("/recipes");
    expect(safeAuthRedirect("//evil.example")).toBe("/recipes");
    expect(safeAuthRedirect("/api/v1/households")).toBe("/recipes");
    expect(safeAuthRedirect("/invite/not-a-token")).toBe("/recipes");
    expect(safeAuthRedirect(null)).toBe("/recipes");
    expect(safeAuthRedirect("/settings")).toBe("/settings");
    expect(safeAuthRedirect("/people")).toBe("/people");
    expect(safeAuthRedirect("/\\evil.com")).toBe("/recipes");
    expect(safeAuthRedirect("/%5Cevil.com")).toBe("/recipes");
    expect(safeAuthRedirect("/%2F%2Fevil.com")).toBe("/recipes");
    expect(safeAuthRedirect("/settings/../api/v1/x")).toBe("/recipes");
    expect(safeAuthRedirect("/settings/%2e%2e/api/v1/x")).toBe("/recipes");
    expect(safeAuthRedirect("/settings/%2E%2E/api/v1/x")).toBe("/recipes");
    expect(safeAuthRedirect("/settings/%252e%252e/api/v1/x")).toBe("/recipes");
    expect(safeAuthRedirect("/settings/.\n./api/v1/x")).toBe("/recipes");
    expect(safeAuthRedirect("/settings/..\t/api/v1/x")).toBe("/recipes");
    expect(safeAuthRedirect("/settings/%2e%0a%2e/api/v1/x")).toBe("/recipes");
  });
});
