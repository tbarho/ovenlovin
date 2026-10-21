import { describe, expect, it } from "vitest";
import { parseRecipeImages, recipeSchema, slugifyTitle } from "./recipes";

describe("slugifyTitle", () => {
  it("turns a title into a url-safe slug", () => {
    expect(slugifyTitle("Chocolate Chip Cookies")).toBe("chocolate-chip-cookies");
  });

  it("falls back when the title has no letters", () => {
    expect(slugifyTitle("!!!")).toBe("recipe");
  });
});

describe("parseRecipeImages", () => {
  it("rejects object-shaped image entries", () => {
    expect(() => parseRecipeImages([{ url: "https://example.com/a.png" }])).toThrow();
    expect(parseRecipeImages(["https://example.com/a.png"])).toEqual(["https://example.com/a.png"]);
    expect(parseRecipeImages(undefined)).toEqual([]);
  });
});

describe("recipeSchema notes", () => {
  it("accepts an optional notes field", () => {
    const parsed = recipeSchema.safeParse({
      id: "00000000-0000-4000-8000-000000000030",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
      createdBy: "00000000-0000-4000-8000-000000000002",
      householdId: "00000000-0000-4000-8000-000000000001",
      title: "Pasta",
      slug: "pasta",
      notes: "Make the sauce a day ahead.",
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.notes).toBe("Make the sauce a day ahead.");
  });
});
