import { describe, expect, it } from "vitest";
import { isKitchenNavActive } from "./kitchen-nav";

describe("isKitchenNavActive", () => {
  it("marks People as current on the list and a person page", () => {
    expect(isKitchenNavActive("/people", "/people")).toBe(true);
    expect(isKitchenNavActive("/people/abc", "/people")).toBe(true);
  });

  it("does not mark Recipes as current on People", () => {
    expect(isKitchenNavActive("/people", "/recipes")).toBe(false);
    expect(isKitchenNavActive("/recipes", "/people")).toBe(false);
  });

  it("marks Recipes as current on recipe detail", () => {
    expect(isKitchenNavActive("/recipes", "/recipes")).toBe(true);
    expect(isKitchenNavActive("/recipes/abc", "/recipes")).toBe(true);
  });

  it("marks Settings as current on the settings page", () => {
    expect(isKitchenNavActive("/settings", "/settings")).toBe(true);
    expect(isKitchenNavActive("/settings", "/people")).toBe(false);
  });

  it("marks Plan and List as current on their own routes", () => {
    expect(isKitchenNavActive("/plans", "/plans")).toBe(true);
    expect(isKitchenNavActive("/list", "/list")).toBe(true);
    expect(isKitchenNavActive("/plans", "/list")).toBe(false);
    expect(isKitchenNavActive("/list", "/plans")).toBe(false);
  });
});
