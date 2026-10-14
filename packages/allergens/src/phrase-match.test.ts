import { describe, expect, it } from "vitest";
import { phraseMatchesAny, phraseMatchesLine, stemWord } from "./phrase-match";

describe("phraseMatchesLine", () => {
  it("matches a word case-insensitively inside an ingredient line", () => {
    expect(phraseMatchesLine("Salmon", "4 salmon fillets")).toBe(true);
    expect(phraseMatchesLine("cilantro", "1/4 cup chopped CILANTRO")).toBe(true);
  });

  it("is plural-tolerant both ways", () => {
    expect(phraseMatchesLine("mushroom", "8 oz mushrooms, sliced")).toBe(true);
    expect(phraseMatchesLine("mushrooms", "1 large mushroom")).toBe(true);
    expect(phraseMatchesLine("pine nut", "1/4 cup pine nuts")).toBe(true);
    expect(phraseMatchesLine("olive", "kalamata olives")).toBe(true);
  });

  it("does not match X-free or no-X wording", () => {
    expect(phraseMatchesLine("nut", "nut-free pesto")).toBe(false);
    expect(phraseMatchesLine("egg", "egg-free mayonnaise")).toBe(false);
    expect(phraseMatchesLine("dairy", "dairy-free milk")).toBe(false);
    expect(phraseMatchesLine("peanut", "without peanuts")).toBe(false);
    expect(phraseMatchesLine("peanut", "no peanuts")).toBe(false);
  });

  it("does not treat olive oil as olives", () => {
    expect(phraseMatchesLine("olive", "2 tbsp olive oil")).toBe(false);
    expect(phraseMatchesLine("olives", "3 tbsp olive oil")).toBe(false);
    expect(phraseMatchesLine("olive oil", "2 tbsp olive oil")).toBe(true);
    expect(phraseMatchesLine("olive", "olive oil and kalamata olives")).toBe(true);
  });

  it("does not match a substring inside a longer word", () => {
    expect(phraseMatchesLine("nut", "nutmeg")).toBe(false);
    expect(phraseMatchesLine("ham", "chamomile")).toBe(false);
  });

  it("matches a multi-word phrase after normalizing punctuation", () => {
    expect(phraseMatchesLine("pine-nuts", "toasted pine nuts")).toBe(true);
    expect(phraseMatchesLine("sheet_pan", "sheet-pan salmon")).toBe(true);
  });

  it("returns false for empty inputs", () => {
    expect(phraseMatchesLine("", "salmon")).toBe(false);
    expect(phraseMatchesLine("salmon", "")).toBe(false);
  });
});

describe("stemWord", () => {
  it("stems simple English plurals", () => {
    expect(stemWord("berries")).toBe("berry");
    expect(stemWord("tomatoes")).toBe("tomato");
    expect(stemWord("peaches")).toBe("peach");
    expect(stemWord("salmon")).toBe("salmon");
  });
});

describe("phraseMatchesAny", () => {
  it("returns true when any line matches", () => {
    expect(phraseMatchesAny("spicy", ["mild soup", "spicy tacos"])).toBe(true);
    expect(phraseMatchesAny("spicy", ["mild soup"])).toBe(false);
  });
});
