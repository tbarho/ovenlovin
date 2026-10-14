import { describe, expect, it } from "vitest";
import { draftFromPlainText, parseMinutesFromText, stripLeadingStepNumber } from "./plain-import";

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

  it("keeps servings, times, and notes from labeled paste text", () => {
    const draft = draftFromPlainText(
      [
        "TEST Parent A Beef Stroganoff",
        "Servings: 4",
        "Prep time: 15 minutes",
        "Cook time: 25 minutes",
        "Notes: Brown the beef in batches.",
        "Ingredients",
        "1 lb beef sirloin",
        "1 cup sour cream",
        "Steps",
        "Cook the beef.",
        "Stir in sour cream.",
      ].join("\n")
    );

    expect(draft.title).toBe("TEST Parent A Beef Stroganoff");
    expect(draft.servings).toBe(4);
    expect(draft.prepTimeMinutes).toBe(15);
    expect(draft.cookTimeMinutes).toBe(25);
    expect(draft.totalTimeMinutes).toBe(40);
    expect(draft.notes).toBe("Brown the beef in batches.");
    expect(draft.ingredients.map((item) => item.rawText)).toEqual([
      "1 lb beef sirloin",
      "1 cup sour cream",
    ]);
    expect(draft.steps.map((item) => item.text)).toEqual(["Cook the beef.", "Stir in sour cream."]);
  });

  it("collects a trailing Notes section instead of turning it into a step", () => {
    const draft = draftFromPlainText(
      [
        "Sheet-pan salmon",
        "Serves 6",
        "Total time: 1 hour 15 minutes",
        "Ingredients",
        "4 salmon fillets",
        "Steps",
        "Roast until flaky.",
        "Notes",
        "Use leftover steak.",
        "Serve over egg noodles.",
      ].join("\n")
    );

    expect(draft.servings).toBe(6);
    expect(draft.totalTimeMinutes).toBe(75);
    expect(draft.notes).toBe("Use leftover steak.\nServe over egg noodles.");
    expect(draft.steps.map((item) => item.text)).toEqual(["Roast until flaky."]);
  });

  it("strips leading step numbers and captures a Source URL", () => {
    const draft = draftFromPlainText(
      [
        "Beef Stroganoff",
        "Source: https://natashaskitchen.com/beef-stroganoff/",
        "Ingredients",
        "1 lb beef",
        "Steps",
        "1. Sear the beef.",
        "2) Stir in sour cream.",
      ].join("\n")
    );
    expect(draft.steps.map((item) => item.text)).toEqual(["Sear the beef.", "Stir in sour cream."]);
    expect(draft.source.url).toBe("https://natashaskitchen.com/beef-stroganoff/");
    expect(draft.ingredients.map((item) => item.rawText)).toEqual(["1 lb beef"]);
  });

  it("stores a non-URL Source line as attribution", () => {
    const draft = draftFromPlainText(
      ["Soup", "Source: Family cookbook", "Ingredients", "1 onion", "Steps", "Simmer."].join("\n")
    );
    expect(draft.source.url).toBeUndefined();
    expect(draft.source.attribution).toBe("Family cookbook");
  });
});

describe("stripLeadingStepNumber", () => {
  it("removes 1. and 2) prefixes but leaves ingredient-like text", () => {
    expect(stripLeadingStepNumber("1. Sear the beef.")).toBe("Sear the beef.");
    expect(stripLeadingStepNumber("2) Mix well.")).toBe("Mix well.");
    expect(stripLeadingStepNumber("1 cup flour")).toBe("1 cup flour");
  });
});

describe("parseMinutesFromText", () => {
  it("reads ISO durations and hour/minute phrases", () => {
    expect(parseMinutesFromText("PT15M")).toBe(15);
    expect(parseMinutesFromText("PT1H15M")).toBe(75);
    expect(parseMinutesFromText("20 minutes")).toBe(20);
    expect(parseMinutesFromText("1 hr 15 min")).toBe(75);
  });
});
