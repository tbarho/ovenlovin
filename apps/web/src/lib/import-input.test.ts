import { describe, expect, it } from "vitest";
import {
  BLOCKED_IMPORT_COPY,
  importGuessedNotice,
  importInputError,
  isBlockedImportError,
  looksLikeHttpUrl,
} from "./import-input";

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
    expect(importInputError("url", "https://example.com/chocolate-chip-cookies")).toBe(
      "No recipe found on this page."
    );
    expect(importInputError("url", "https://example.com/chocolate-chip-cookies")).not.toMatch(
      /blocked/i
    );
  });

  it("treats a server block as the inline help copy", () => {
    expect(
      isBlockedImportError("This site blocked the importer (tried direct, google-translate, jina).")
    ).toBe(true);
    expect(isBlockedImportError(BLOCKED_IMPORT_COPY)).toBe(true);
    expect(isBlockedImportError("No recipe found on this page.")).toBe(false);
  });

  it("names guessed servings after a paste import", () => {
    expect(importGuessedNotice("Test Recipe 1", 4)).toBe(
      "Imported Test Recipe 1 · 4 servings (guessed)"
    );
    expect(importGuessedNotice("Beef Stroganoff", null)).toBe(
      "Imported Beef Stroganoff · servings unknown"
    );
  });
});
