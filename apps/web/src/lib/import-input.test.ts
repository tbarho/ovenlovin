import { describe, expect, it } from "vitest";
import { importGuessedNotice, importInputError, looksLikeHttpUrl } from "./import-input";

describe("import input", () => {
  it("rejects an empty paste", () => {
    expect(importInputError("paste", "   ")).toBe("Paste a recipe first");
  });

  it("rejects a string that is not a web address", () => {
    expect(looksLikeHttpUrl("not a url")).toBe(false);
    expect(importInputError("url", "not a url")).toBe("That doesn't look like a web address");
    expect(looksLikeHttpUrl("https://example.com/cookies")).toBe(true);
  });

  it("names guessed servings after a paste import", () => {
    expect(importGuessedNotice("Test Recipe 1", 4)).toBe(
      "Imported Test Recipe 1 · 4 servings (guessed)"
    );
  });
});
