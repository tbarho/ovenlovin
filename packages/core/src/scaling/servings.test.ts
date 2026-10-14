import { describe, expect, it } from "vitest";
import {
  clampServings,
  formatDurationMinutes,
  formatQuantity,
  scaleFactorForPlanEntry,
  scaleIngredientDisplay,
  scaleQuantity,
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
    expect(formatQuantity(2)).toBe("2");
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
    ).toBe("4 1/2 cup all-purpose flour");
  });

  it("leaves unquantified lines unchanged", () => {
    expect(scaleIngredientDisplay({ rawText: "salt to taste" }, 4, 8)).toBe("salt to taste");
  });

  it("parses raw text when structured quantity is missing", () => {
    expect(scaleIngredientDisplay({ rawText: "1 tsp salt" }, 4, 2)).toBe("1/2 tsp salt");
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
    expect(clampServings(48)).toBe(24);
    expect(clampServings(6.4)).toBe(6);
  });
});
