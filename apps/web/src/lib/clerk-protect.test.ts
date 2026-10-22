import { readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { isClerkProtectExempt, isClerkProtectedPath } from "./clerk-protect";

// Pages and routes outside this set must be kitchen-protected or a self-auth API.
const publicTops = new Set([
  "sign-in",
  "sign-up",
  "docs",
  "invite",
  "dev",
  "prototype",
  "llms.txt",
  "mcp",
]);

const selfAuthApi = ["/api", "/api/v1", "/api/cron", "/api/demo"] as const;

function isSelfAuthApi(pathname: string): boolean {
  return selfAuthApi.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

function listAppRoutes(dir: string, prefix = ""): string[] {
  const routes: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const next = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const segment = entry.name.startsWith("(") ? "" : `/${entry.name}`;
      routes.push(...listAppRoutes(next, `${prefix}${segment}`));
    } else if (entry.name === "page.tsx" || entry.name === "route.ts") {
      routes.push(prefix || "/");
    }
  }
  return routes;
}

describe("isClerkProtectedPath", () => {
  it("protects every App Router page and route that is not a known public root", () => {
    const appDir = path.resolve(__dirname, "../app");
    for (const route of listAppRoutes(appDir)) {
      if (route === "/") continue;
      if (route === "/api" || route.startsWith("/api/")) {
        expect(isSelfAuthApi(route) || isClerkProtectedPath(route), route).toBe(true);
        continue;
      }
      const top =
        route
          .split("/")
          .filter(Boolean)[0]
          ?.replace(/\[.+\]/g, "") ?? "";
      if (publicTops.has(top)) continue;
      expect(isClerkProtectedPath(route), route).toBe(true);
    }
  });

  it("protects kitchen pages and leaves unknown public URLs alone", () => {
    expect(isClerkProtectedPath("/recipes")).toBe(true);
    expect(isClerkProtectedPath("/recipes/abc")).toBe(true);
    expect(isClerkProtectedPath("/plans")).toBe(true);
    expect(isClerkProtectedPath("/list")).toBe(true);
    expect(isClerkProtectedPath("/people/jake")).toBe(true);
    expect(isClerkProtectedPath("/settings")).toBe(true);
    expect(isClerkProtectedPath("/this-does-not-exist")).toBe(false);
    expect(isClerkProtectedPath("/anything")).toBe(false);
    expect(isClerkProtectedPath("/docs")).toBe(false);
    expect(isClerkProtectedPath("/sign-in")).toBe(false);
  });
});

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
    expect(
      isClerkProtectExempt("/invite/olinv_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa")
    ).toBe(true);
    expect(isClerkProtectExempt("/mcp")).toBe(true);
    expect(isClerkProtectExempt("/docs")).toBe(true);
    expect(isClerkProtectExempt("/docs/connect-your-agent")).toBe(true);
    expect(isClerkProtectExempt("/llms.txt")).toBe(true);
    expect(isClerkProtectExempt("/robots.txt")).toBe(true);
    expect(isClerkProtectExempt("/sitemap.xml")).toBe(true);
    expect(isClerkProtectExempt("/manifest.webmanifest")).toBe(true);
    expect(isClerkProtectExempt("/api/cron/demo-cleanup")).toBe(true);
    expect(isClerkProtectExempt("/api/demo/enter")).toBe(true);
    expect(isClerkProtectExempt("/brand/og.png")).toBe(true);
  });
});
