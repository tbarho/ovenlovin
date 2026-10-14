import { describe, expect, it } from "vitest";
import { draftFromPlainText } from "./plain-import";

describe("draftFromPlainText", () => {
  it("uses the first line as the title and labeled sections", () => {
    const draft = draftFromPlainText(
      ["Pancakes", "Ingredients", "1 cup flour", "Steps", "Mix and cook."].join("\n")
    );
    expect(draft.title).toBe("Pancakes");
    expect(draft.ingredients.map((item) => item.rawText)).toEqual(["1 cup flour"]);
    expect(draft.steps.map((item) => item.text)).toEqual(["Mix and cook."]);
    expect(draft.source.importerName).toBe("plain-paste");
    expect(draft.needsReview).toBe(true);
  });

  it("falls back to Untitled recipe for empty paste", () => {
    expect(draftFromPlainText("").title).toBe("Untitled recipe");
  });
});
