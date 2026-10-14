import { describe, expect, it } from "vitest";
import {
  DEMO_ENTER_PATH,
  safeDemoEnterNext,
  shouldRedirectToDemoEnter,
  wantsDemoEnterJson,
} from "./enter";

describe("demo enter helpers", () => {
  it("rejects open redirects and API/MCP next targets", () => {
    expect(safeDemoEnterNext(null)).toBe("/recipes");
    expect(safeDemoEnterNext("/settings")).toBe("/settings");
    expect(safeDemoEnterNext("/people?tab=rules")).toBe("/people?tab=rules");
    expect(safeDemoEnterNext("https://evil.example/")).toBe("/recipes");
    expect(safeDemoEnterNext("//evil.example")).toBe("/recipes");
    expect(safeDemoEnterNext("/api/demo/enter")).toBe("/recipes");
    expect(safeDemoEnterNext("/mcp")).toBe("/recipes");
  });

  it("sends uncookied kitchen pages to enter, not MCP or cron", () => {
    expect(shouldRedirectToDemoEnter("/recipes", undefined)).toBe(true);
    expect(shouldRedirectToDemoEnter("/settings", undefined)).toBe(true);
    expect(shouldRedirectToDemoEnter("/", undefined)).toBe(true);
    expect(shouldRedirectToDemoEnter("/recipes", "sandbox-id")).toBe(false);
    expect(shouldRedirectToDemoEnter(DEMO_ENTER_PATH, undefined)).toBe(false);
    expect(shouldRedirectToDemoEnter("/api/cron/demo-cleanup", undefined)).toBe(false);
    expect(shouldRedirectToDemoEnter("/mcp", undefined)).toBe(false);
    expect(shouldRedirectToDemoEnter("/demo-kitchen/pesto.svg", undefined)).toBe(false);
  });

  it("returns JSON for agents, HTML redirect for browser navigation", () => {
    expect(
      wantsDemoEnterJson({
        accept: "application/json",
        format: null,
        secFetchDest: null,
      })
    ).toBe(true);
    expect(
      wantsDemoEnterJson({
        accept: "text/html",
        format: "json",
        secFetchDest: "document",
      })
    ).toBe(true);
    expect(
      wantsDemoEnterJson({
        accept: "text/html,application/xhtml+xml",
        format: null,
        secFetchDest: "document",
      })
    ).toBe(false);
  });
});
