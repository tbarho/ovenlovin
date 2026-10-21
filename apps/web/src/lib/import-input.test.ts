import { describe, expect, it } from "vitest";
import {
  BLOCKED_IMPORT_COPY,
  NOT_A_RECIPE_COPY,
  PAGE_GONE_COPY,
  UNSUPPORTED_SITE_COPY,
  displayImportFailure,
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
      NOT_A_RECIPE_COPY
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
    expect(isBlockedImportError(NOT_A_RECIPE_COPY)).toBe(false);
    expect(displayImportFailure("This site blocked the importer (tried direct).")).toBe(
      BLOCKED_IMPORT_COPY
    );
    expect(displayImportFailure("No recipe found on this page.")).toBe(NOT_A_RECIPE_COPY);
    expect(displayImportFailure("We couldn't find a recipe in that text/photo")).toBe(
      NOT_A_RECIPE_COPY
    );
    expect(displayImportFailure("This is not a recipe page.")).toBe(NOT_A_RECIPE_COPY);
    expect(NOT_A_RECIPE_COPY).toMatch(/Paste the recipe text or add a photo/);
    expect(BLOCKED_IMPORT_COPY).toMatch(/Paste the recipe text or add a photo/);
    expect(PAGE_GONE_COPY).toMatch(/Paste the recipe text or add a photo/);
    expect(displayImportFailure(PAGE_GONE_COPY)).toBe(PAGE_GONE_COPY);
    expect(displayImportFailure(UNSUPPORTED_SITE_COPY)).toBe(UNSUPPORTED_SITE_COPY);
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
