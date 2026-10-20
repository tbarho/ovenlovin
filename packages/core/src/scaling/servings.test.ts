import { describe, expect, it } from "vitest";
import { DECIMAL_TWO_THIRDS_CARROT, DECIMAL_TWO_THIRDS_CELERY } from "./quantity-display.fixture";
import {
  clampServings,
  servingsRangeMax,
  formatDurationMinutes,
  formatMeasureText,
  formatQuantity,
  isCountableShopItem,
  pluralizeUnit,
  scaleFactorForPlanEntry,
  scaleIngredientDisplay,
  scaleQuantity,
  toFriendlyMeasure,
  wholeShopQuantity,
} from "./servings";

describe("scaleFactorForPlanEntry", () => {
  it("stores entry servings divided by recipe servings", () => {
    expect(scaleFactorForPlanEntry(8, 4, 1)).toBe(2);
    expect(scaleFactorForPlanEntry(6, 4, 1)).toBe(1.5);
    expect(scaleFactorForPlanEntry(6, 6, 1)).toBe(1);
    expect(scaleFactorForPlanEntry(4, 4)).toBe(1);
  });

  it("uses a 4-serving default when the recipe card has no yield", () => {
    expect(scaleFactorForPlanEntry(8, null, 1)).toBe(2);
    expect(scaleFactorForPlanEntry(6, undefined, 1)).toBe(1.5);
  });

  it("falls back to an explicit scaleFactor only when the entry has no servings", () => {
    expect(scaleFactorForPlanEntry(null, 4, 2)).toBe(2);
    expect(scaleFactorForPlanEntry(undefined, null, 1)).toBe(1);
    expect(scaleFactorForPlanEntry()).toBe(1);
  });

  it("uses the larger of recipe yield and cook-for when the entry has no servings", () => {
    expect(scaleFactorForPlanEntry(null, 6, 1, 5)).toBe(1);
    expect(scaleFactorForPlanEntry(undefined, 6, 1, 5)).toBe(1);
    expect(scaleFactorForPlanEntry(5, 6, 1, 8)).toBe(0.8333);
  });

  it("honors a stored scaleFactor before cook-for when the entry has no servings", () => {
    expect(scaleFactorForPlanEntry(null, 4, 2, 5)).toBe(2);
  });

  it("uses recipe yield in recipe mode when the entry has no servings", () => {
    expect(scaleFactorForPlanEntry(null, 6, 1, 4, "recipe")).toBe(1);
  });
});

describe("scaleQuantity", () => {
  it("scales proportionally", () => {
    expect(scaleQuantity(2, 4, 8)).toBe(4);
    expect(scaleQuantity(0.25, 4, 2)).toBe(0.125);
  });
});

describe("formatQuantity", () => {
  it("uses cooking fractions", () => {
    expect(formatQuantity(0.5)).toBe("1/2");
    expect(formatQuantity(2.25)).toBe("2 1/4");
    expect(formatQuantity(1 / 3)).toBe("1/3");
    expect(formatQuantity(2 / 3)).toBe("2/3");
    expect(formatQuantity(2)).toBe("2");
    expect(formatQuantity(1 + 1 / 3)).toBe("1 1/3");
    expect(formatQuantity(0.125)).toBe("1/8");
    expect(formatQuantity(0.25)).toBe("1/4");
    expect(formatQuantity(0.75)).toBe("3/4");
  });

  it("formats 2/3 scaled by 2 as a mixed number", () => {
    expect(formatQuantity((2 / 3) * 2)).toBe("1 1/3");
  });

  it("rounds odd scaled values onto nearby cooking fractions", () => {
    expect(formatQuantity((2 / 3) * (5 / 4))).toBe("3/4");
    expect(formatQuantity((1 / 3) * 2)).toBe("2/3");
    expect(formatQuantity(0.44)).toBe("1/2");
  });

  it("snaps floating-point noise and stored decimal leftovers to fractions", () => {
    expect(formatQuantity(0.6666666667)).toBe("2/3");
    expect(formatQuantity(0.3333333333)).toBe("1/3");
    expect(formatQuantity(0.6667)).toBe("2/3");
    expect(formatQuantity(Number("0.6666666666666666"))).toBe("2/3");
    expect(formatQuantity(2 / 3 + Number.EPSILON)).toBe("2/3");
    expect(formatQuantity(1 / 3 + Number.EPSILON)).toBe("1/3");
    expect(formatQuantity(1.3333333333)).toBe("1 1/3");
  });
});

describe("toFriendlyMeasure", () => {
  it("converts ugly spoon amounts into a shoppable fraction", () => {
    expect(toFriendlyMeasure(1.8333, "tbsp")).toEqual({
      displayQuantity: "1 3/4",
      displayUnit: "tbsp",
    });
    expect(formatMeasureText(1.8333, "tbsp")).toBe("1 3/4 tbsp");
    expect(formatMeasureText(2, "clove")).toBe("2 cloves");
    expect(pluralizeUnit("2", "clove")).toBe("2 cloves");
    expect(pluralizeUnit("1", "clove")).toBe("1 clove");
    expect(pluralizeUnit("2/3", "cup")).toBe("2/3 cup");
    expect(pluralizeUnit("2", "dash")).toBe("2 dashes");
    expect(pluralizeUnit("2", "glass")).toBe("2 glass");
    expect(pluralizeUnit("1/2-1", "lb")).toBe("1/2-1 lb");
    expect(pluralizeUnit("2", "tsp.")).toBe("2 tsp");
  });

  it("keeps a third-cup instead of 0.33 cup", () => {
    expect(toFriendlyMeasure(0.33, "cup")).toEqual({
      displayQuantity: "1/3",
      displayUnit: "cup",
    });
    expect(toFriendlyMeasure(1 / 3, "cup")).toEqual({
      displayQuantity: "1/3",
      displayUnit: "cup",
    });
  });

  it("promotes exact larger units and leaves integers alone", () => {
    expect(toFriendlyMeasure(3, "tsp")).toEqual({ displayQuantity: "1", displayUnit: "tbsp" });
    expect(toFriendlyMeasure(8, "tbsp")).toEqual({ displayQuantity: "1/2", displayUnit: "cup" });
    expect(toFriendlyMeasure(5, "tbsp")).toEqual({ displayQuantity: "5", displayUnit: "tbsp" });
    expect(toFriendlyMeasure(0.5, "tsp")).toEqual({ displayQuantity: "1/2", displayUnit: "tsp" });
  });

  it("keeps small spoon amounts as tbsp instead of 1/8 cup", () => {
    expect(toFriendlyMeasure(2, "tbsp")).toEqual({ displayQuantity: "2", displayUnit: "tbsp" });
    expect(toFriendlyMeasure(0.125, "cup")).toEqual({ displayQuantity: "2", displayUnit: "tbsp" });
    expect(toFriendlyMeasure(6, "tsp")).toEqual({ displayQuantity: "2", displayUnit: "tbsp" });
    expect(formatMeasureText(2, "tbsp")).toBe("2 tbsp");
    expect(formatMeasureText(0.125, "cup")).toBe("2 tbsp");
  });

  it("promotes a large spoon amount to the nearest kitchen cup", () => {
    expect(toFriendlyMeasure(13.75, "tbsp")).toEqual({
      displayQuantity: "3/4",
      displayUnit: "cup",
    });
    expect(formatMeasureText(13.75, "tbsp")).toBe("3/4 cup");
  });
});

describe("scaleIngredientDisplay", () => {
  it("rebuilds a line with scaled fractions", () => {
    expect(
      scaleIngredientDisplay(
        { rawText: "2 1/4 cups all-purpose flour", quantityMin: 2.25, unit: "cup" },
        4,
        8
      )
    ).toBe("4 1/2 cups all-purpose flour");
  });

  it("leaves unquantified lines unchanged", () => {
    expect(scaleIngredientDisplay({ rawText: "salt to taste" }, 4, 8)).toBe("salt to taste");
  });

  it("parses raw text when structured quantity is missing", () => {
    expect(scaleIngredientDisplay({ rawText: "1 tsp salt" }, 4, 2)).toBe("1/2 tsp salt");
  });

  it("formats schema.org 2/3 decimals at 1x without rewriting storage", () => {
    expect(scaleIngredientDisplay(DECIMAL_TWO_THIRDS_CELERY, 8, 8)).toBe("2/3 cup celery");
    expect(scaleIngredientDisplay(DECIMAL_TWO_THIRDS_CARROT, 4, 4)).toBe("2/3 cup carrot");
    expect(DECIMAL_TWO_THIRDS_CELERY.rawText).toBe("0.6666666667 cup celery");
    expect(DECIMAL_TWO_THIRDS_CARROT.rawText).toBe("0.6666666667 cup carrot");
  });

  it("scales 2/3 celery to a mixed number", () => {
    expect(scaleIngredientDisplay(DECIMAL_TWO_THIRDS_CELERY, 4, 8)).toBe("1 1/3 cups celery");
  });

  it("singularizes cups when a 2-cup line scales down to 1", () => {
    expect(
      scaleIngredientDisplay(
        { rawText: "2 cups shredded mozzarella", quantityMin: 2, unit: "cup" },
        8,
        4
      )
    ).toBe("1 cup shredded mozzarella");
    expect(pluralizeUnit("1", "cups")).toBe("1 cup");
  });

  it("does not prepend a stored unit when it is not right after the quantity", () => {
    expect(
      scaleIngredientDisplay(
        { rawText: "2 (14 oz) cans diced tomatoes", quantityMin: 2, unit: "can" },
        4,
        4
      )
    ).toBe("2 (14 oz) cans diced tomatoes");
    expect(
      scaleIngredientDisplay(
        { rawText: "2 (14 oz) cans diced tomatoes", quantityMin: 2, unit: "can" },
        4,
        2
      )
    ).toBe("1 (14 oz) can diced tomatoes");
  });

  it("rounds countable recipe amounts the same way the shopping list does", () => {
    expect(scaleIngredientDisplay({ rawText: "2 eggs" }, 4, 5)).toBe("3 eggs");
    expect(scaleIngredientDisplay({ rawText: "1 egg" }, 6, 5)).toBe("1 egg");
    expect(
      scaleIngredientDisplay({ rawText: "0.44 cup milk", quantityMin: 0.44, unit: "cup" }, 4, 4)
    ).toBe("1/2 cup milk");
  });

  it("keeps abbreviated units that end in a period", () => {
    expect(scaleIngredientDisplay({ rawText: "½ lb. ground beef" }, 4, 4)).toBe(
      "1/2 lb ground beef"
    );
    expect(
      scaleIngredientDisplay({ rawText: "2 tsp. baking soda", quantityMin: 2, unit: "tsp." }, 4, 4)
    ).toBe("2 tsp baking soda");
  });
});

describe("formatDurationMinutes", () => {
  it("formats hours and minutes", () => {
    expect(formatDurationMinutes(15)).toBe("15 min");
    expect(formatDurationMinutes(60)).toBe("1 hr");
    expect(formatDurationMinutes(90)).toBe("1 hr 30 min");
  });
});

describe("clampServings", () => {
  it("keeps servings in a usable cooking range", () => {
    expect(clampServings(0)).toBe(1);
    expect(clampServings(48)).toBe(48);
    expect(clampServings(6.4)).toBe(6);
    expect(servingsRangeMax(4, 5)).toBe(24);
    expect(servingsRangeMax(48, 5)).toBe(48);
  });
});

describe("countable shopping amounts", () => {
  it("treats eggs, cans, and whole items as countable and cups as measured", () => {
    expect(isCountableShopItem(undefined)).toBe(true);
    expect(isCountableShopItem("")).toBe(true);
    expect(isCountableShopItem("can")).toBe(true);
    expect(isCountableShopItem("clove")).toBe(true);
    expect(isCountableShopItem("cup")).toBe(false);
    expect(isCountableShopItem("lb")).toBe(false);
    expect(isCountableShopItem("tbsp")).toBe(false);
  });

  it("rounds countable grocery amounts up to a whole unit", () => {
    expect(wholeShopQuantity(2.5)).toBe(3);
    expect(wholeShopQuantity(2 / 3)).toBe(1);
    expect(wholeShopQuantity(5 / 6)).toBe(1);
    expect(wholeShopQuantity(2)).toBe(2);
    expect(formatMeasureText(2.5, undefined)).toBe("3");
    expect(formatMeasureText(2 / 3, "can")).toBe("1 can");
    expect(formatMeasureText(5 / 6, "lb")).toBe("3/4 lb");
  });
});
