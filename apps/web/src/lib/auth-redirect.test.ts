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
  });
});
