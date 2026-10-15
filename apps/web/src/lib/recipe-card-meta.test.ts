import { describe, expect, it } from "vitest";
import { recipeCardMeta } from "./recipe-card-meta";

describe("recipeCardMeta", () => {
  it("joins servings and times", () => {
    expect(recipeCardMeta({ servings: 4, prepTimeMinutes: 10, cookTimeMinutes: 20 })).toBe(
      "4 servings · 10 min prep · 20 min cook"
    );
  });

  it("never falls back to an internal status label", () => {
    expect(recipeCardMeta({})).toBe("Add details");
  });
});
