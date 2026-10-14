import { describe, expect, it } from "vitest";
import { isClerkProtectExempt } from "./clerk-protect";

describe("isClerkProtectExempt", () => {
  it("lets REST authenticate itself so API keys are not HTML-404'd", () => {
    expect(isClerkProtectExempt("/api/v1/recipes")).toBe(true);
    expect(isClerkProtectExempt("/api/v1/recipes/abc")).toBe(true);
    expect(isClerkProtectExempt("/api/v1/cookbooks")).toBe(true);
    expect(isClerkProtectExempt("/api/v1/people")).toBe(true);
    expect(isClerkProtectExempt("/api/v1/meal-plans")).toBe(true);
    expect(isClerkProtectExempt("/api/v1/households")).toBe(true);
    expect(isClerkProtectExempt("/api/v1/api-keys")).toBe(true);
    expect(isClerkProtectExempt("/api/v1/openapi.json")).toBe(true);
  });

  it("still protects signed-in kitchen pages", () => {
    expect(isClerkProtectExempt("/recipes")).toBe(false);
    expect(isClerkProtectExempt("/people")).toBe(false);
    expect(isClerkProtectExempt("/settings")).toBe(false);
  });

  it("keeps marketing, auth, MCP, and brand public", () => {
    expect(isClerkProtectExempt("/")).toBe(true);
    expect(isClerkProtectExempt("/sign-in")).toBe(true);
    expect(isClerkProtectExempt("/sign-up/verify")).toBe(true);
    expect(isClerkProtectExempt("/mcp")).toBe(true);
    expect(isClerkProtectExempt("/brand/og.png")).toBe(true);
  });
});
