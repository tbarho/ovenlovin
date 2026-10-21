import { describe, expect, it } from "vitest";
import {
  backfillParsedIngredient,
  normalizeIngredientName,
  parseIngredientLine,
  splitLeadingUnit,
} from "./ingredient-line";

describe("parseIngredientLine", () => {
  it("parses mixed fractions and cups", () => {
    const parsed = parseIngredientLine("2 1/4 cups all-purpose flour");
    expect(parsed.quantityMin).toBe(2.25);
    expect(parsed.quantityMax).toBeNull();
    expect(parsed.unit).toBe("cup");
    expect(parsed.name).toBe("all-purpose flour");
  });

  it("parses unicode fractions", () => {
    const parsed = parseIngredientLine("½ cup olive oil");
    expect(parsed.quantityMin).toBe(0.5);
    expect(parsed.unit).toBe("cup");
    expect(parsed.name).toBe("olive oil");
  });

  it("parses ranges", () => {
    const parsed = parseIngredientLine("1-2 tbsp olive oil");
    expect(parsed.quantityMin).toBe(1);
    expect(parsed.quantityMax).toBe(2);
    expect(parsed.unit).toBe("tbsp");
  });

  it("strips to-taste from an unquantified pantry staple", () => {
    const parsed = parseIngredientLine("salt to taste");
    expect(parsed.quantityMin).toBeNull();
    expect(parsed.unit).toBeNull();
    expect(parsed.name).toBe("salt");
  });

  it("parses the item name separately from quantity, unit, and prep", () => {
    const parsed = parseIngredientLine("3 cloves garlic, minced");
    expect(parsed.quantityMin).toBe(3);
    expect(parsed.unit).toBe("clove");
    expect(parsed.name).toBe("garlic");
  });

  it("parses an onion line into the grocery item name", () => {
    const parsed = parseIngredientLine("1 yellow onion");
    expect(parsed.quantityMin).toBe(1);
    expect(parsed.unit).toBeNull();
    expect(parsed.name).toBe("yellow onion");
  });

  it("drops trailing parentheticals from the item name", () => {
    const parsed = parseIngredientLine("1 cup flour (sifted)");
    expect(parsed.name).toBe("flour");
  });

  it("reads a unit glued to the item name", () => {
    expect(parseIngredientLine("1 cupsour cream")).toMatchObject({
      quantityMin: 1,
      unit: "cup",
      name: "sour cream",
    });
    expect(parseIngredientLine("10 oz.mushrooms")).toMatchObject({
      quantityMin: 10,
      unit: "oz",
      name: "mushrooms",
    });
    expect(parseIngredientLine("2 cups flour")).toMatchObject({
      quantityMin: 2,
      unit: "cup",
      name: "flour",
    });
  });

  it("reads sweep lines: c., hyphen mixed, and, grams, unit after parens", () => {
    expect(parseIngredientLine("2 2/3 c. flour")).toMatchObject({
      quantityMin: 8 / 3,
      quantityMax: null,
      unit: "cup",
      name: "flour",
    });
    expect(parseIngredientLine("2-1/3 cups flour")).toMatchObject({
      quantityMin: 7 / 3,
      quantityMax: null,
      unit: "cup",
    });
    expect(parseIngredientLine("2 and 1/4 cups chocolate chips")).toMatchObject({
      quantityMin: 2.25,
      quantityMax: null,
      unit: "cup",
    });
    expect(parseIngredientLine("1 and 1/2 tsp vanilla")).toMatchObject({
      quantityMin: 1.5,
      unit: "tsp",
    });
    expect(parseIngredientLine("150g butter")).toMatchObject({
      quantityMin: 150,
      unit: "g",
      name: "butter",
    });
    expect(parseIngredientLine("175g / 12 tbsp butter")).toMatchObject({
      quantityMin: 175,
      unit: "g",
    });
    expect(parseIngredientLine("2 1/2 (350 g) cups flour")).toMatchObject({
      quantityMin: 2.5,
      unit: "cup",
      name: "flour",
    });
    expect(parseIngredientLine("1-2 tbsp olive oil")).toMatchObject({
      quantityMin: 1,
      quantityMax: 2,
      unit: "tbsp",
    });
  });
});

describe("normalizeIngredientName", () => {
  it("collapses case and punctuation for merge keys", () => {
    expect(normalizeIngredientName("Olive Oil")).toBe("olive oil");
    expect(normalizeIngredientName("all-purpose flour")).toBe("all purpose flour");
  });
});

describe("backfillParsedIngredient", () => {
  it("fills name on existing rows that only stored rawText, quantity, and unit", () => {
    const backfilled = backfillParsedIngredient({
      rawText: "2 tbsp olive oil",
      quantityMin: 2,
      unit: "tbsp",
    });
    expect(backfilled.name).toBe("olive oil");
    expect(backfilled.quantityMin).toBe(2);
    expect(backfilled.unit).toBe("tbsp");
  });

  it("parses quantity and unit when the stored row has only rawText", () => {
    const backfilled = backfillParsedIngredient({ rawText: "1 yellow onion" });
    expect(backfilled).toEqual({
      name: "yellow onion",
      quantityMin: 1,
      quantityMax: null,
      unit: null,
    });
  });

  it("keeps an already-stored item name", () => {
    const backfilled = backfillParsedIngredient({
      rawText: "2 tbsp olive oil",
      name: "extra-virgin olive oil",
    });
    expect(backfilled.name).toBe("extra-virgin olive oil");
  });

  it("re-parses when the stored name is the whole line", () => {
    const backfilled = backfillParsedIngredient({
      rawText: "2 tbsp olive oil",
      name: "2 tbsp olive oil",
    });
    expect(backfilled.name).toBe("olive oil");
  });
});

describe("splitLeadingUnit", () => {
  it("peels a plural unit off the rest of the line", () => {
    expect(splitLeadingUnit("cups shredded mozzarella")).toEqual({
      unit: "cup",
      rest: "shredded mozzarella",
    });
    expect(splitLeadingUnit("cloves garlic")).toEqual({ unit: "clove", rest: "garlic" });
    expect(splitLeadingUnit("shredded mozzarella")).toEqual({
      unit: null,
      rest: "shredded mozzarella",
    });
    expect(splitLeadingUnit("lb. ground beef")).toEqual({ unit: "lb", rest: "ground beef" });
  });
});
