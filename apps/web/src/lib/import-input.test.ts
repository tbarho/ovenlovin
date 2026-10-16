import { describe, expect, it } from "vitest";
import { importGuessedNotice, importInputError, looksLikeHttpUrl } from "./import-input";

describe("import input", () => {
  it("rejects an empty paste", () => {
    expect(importInputError("paste", "   ")).toBe("Paste a recipe first");
  });

  it("rejects a string that is not a web address", () => {
    expect(looksLikeHttpUrl("not a url")).toBe(false);
    expect(importInputError("url", "not a url")).toBe("That doesn't look like a web address");
    expect(looksLikeHttpUrl("https://www.allrecipes.com/cookies")).toBe(true);
  });

  it("does not call a placeholder example.com address blocked", () => {
    expect(importInputError("url", "https://example.com/chocolate-chip-cookies")).toMatch(
      /placeholder/i
    );
    expect(importInputError("url", "https://example.com/chocolate-chip-cookies")).not.toMatch(
      /blocked/i
    );
  });

  it("names guessed servings after a paste import", () => {
    expect(importGuessedNotice("Test Recipe 1", 4)).toBe(
      "Imported Test Recipe 1 · 4 servings (guessed)"
    );
  });
});
