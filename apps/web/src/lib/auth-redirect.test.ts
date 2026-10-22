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
    expect(safeAuthRedirect("/\t/evil.com")).toBe("/recipes");
  });

  it("reduces same-origin absolute URLs from Clerk to path and search", () => {
    const origins = ["https://kitchen.example"];
    expect(safeAuthRedirect("https://kitchen.example/recipes?x=1", origins)).toBe("/recipes?x=1");
    expect(safeAuthRedirect(`https://kitchen.example/invite/${token}`, origins)).toBe(
      `/invite/${token}`
    );
    expect(safeAuthRedirect("https://kitchen.example/people#jake", origins)).toBe("/people");
    expect(safeAuthRedirect("https://kitchen.example/recipes", [])).toBe("/recipes");
    expect(safeAuthRedirect("https://kitchen.example/people", [])).toBe("/recipes");
    expect(safeAuthRedirect("https://evil.example/people", origins)).toBe("/recipes");
    expect(safeAuthRedirect("http://kitchen.example/people", origins)).toBe("/recipes");
    expect(safeAuthRedirect("https://kitchen.example.evil.example/people", origins)).toBe(
      "/recipes"
    );
    expect(safeAuthRedirect("https://kitchen.example//evil.example", origins)).toBe("/recipes");
    expect(safeAuthRedirect("https://kitchen.example/people/../api/v1/x", origins)).toBe(
      "/recipes"
    );
    expect(safeAuthRedirect("https://kitchen.example/%2F%2Fevil.com", origins)).toBe("/recipes");
    expect(safeAuthRedirect("javascript:alert(1)", origins)).toBe("/recipes");
    expect(safeAuthRedirect("https://kitchen.example/people\t", origins)).toBe("/recipes");
  });

  it("ignores an unparseable allowed origin without disabling the others", () => {
    const origins = ["kitchen.example", "https://kitchen.example"];
    expect(safeAuthRedirect("https://kitchen.example/people", origins)).toBe("/people");
    expect(safeAuthRedirect("https://kitchen.example/people", ["kitchen.example"])).toBe(
      "/recipes"
    );
  });
});
