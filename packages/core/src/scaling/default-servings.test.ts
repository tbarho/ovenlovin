import { describe, expect, it } from "vitest";
import {
  defaultDisplayedServings,
  normalizeHouseholdServingsSetting,
  planEntryServings,
  recipeServingsPresentation,
  recipeYieldServings,
  scaledServingsNote,
  weekDefaultServings,
} from "./default-servings";

describe("defaultDisplayedServings", () => {
  it("opens a 4-serving recipe at family size and leaves a larger yield alone", () => {
    expect(
      defaultDisplayedServings({
        recipeServings: 4,
        familySize: 8,
        mode: "family",
      })
    ).toBe(8);
    expect(
      defaultDisplayedServings({
        recipeServings: 10,
        familySize: 8,
        mode: "family",
      })
    ).toBe(10);
  });

  it("uses a 4-serving yield when the card omits servings", () => {
    expect(
      defaultDisplayedServings({
        recipeServings: null,
        familySize: 5,
        mode: "family",
      })
    ).toBe(5);
  });

  it("uses a fixed kitchen number, or the recipe yield in recipe mode", () => {
    expect(
      defaultDisplayedServings({
        recipeServings: 4,
        familySize: 8,
        mode: "fixed",
        fixedServings: 6,
      })
    ).toBe(6);
    expect(
      defaultDisplayedServings({
        recipeServings: 10,
        familySize: 8,
        mode: "recipe",
      })
    ).toBe(10);
  });
});

describe("weekDefaultServings and planEntryServings", () => {
  it("defaults the week cook-for to family size", () => {
    expect(weekDefaultServings({ familySize: 8, mode: "family" })).toBe(8);
    expect(weekDefaultServings({ familySize: 0, mode: "family" })).toBe(4);
    expect(weekDefaultServings({ familySize: 8, mode: "fixed", fixedServings: 12 })).toBe(12);
    expect(weekDefaultServings({ familySize: 8, mode: "recipe" })).toBe(4);
  });

  it("stores max(yield, cook-for) for family plan entries", () => {
    expect(planEntryServings({ recipeServings: 4, cookFor: 8, mode: "family" })).toBe(8);
    expect(planEntryServings({ recipeServings: 10, cookFor: 8, mode: "family" })).toBe(10);
    expect(planEntryServings({ recipeServings: 10, cookFor: 8, mode: "fixed" })).toBe(8);
    expect(planEntryServings({ recipeServings: 10, cookFor: 8, mode: "recipe" })).toBe(10);
  });
});

describe("notes and settings", () => {
  it("names the family scale and can reset copy", () => {
    expect(
      scaledServingsNote({
        displayed: 8,
        recipeServings: 4,
        mode: "family",
        familySize: 8,
      })
    ).toBe("Scaled to 8 for your family");
    expect(
      scaledServingsNote({
        displayed: 4,
        recipeServings: 4,
        mode: "family",
        familySize: 8,
      })
    ).toBeNull();
    expect(
      scaledServingsNote({
        displayed: 6,
        recipeServings: 4,
        mode: "fixed",
        familySize: 8,
        fixedServings: 6,
      })
    ).toBe("Scaled to 6 from the kitchen default");
    expect(
      scaledServingsNote({
        displayed: 9,
        recipeServings: 4,
        mode: "fixed",
        familySize: 8,
        fixedServings: 6,
      })
    ).toBe("Scaled from 4 stored servings");
  });

  it("requires a positive number for a fixed setting", () => {
    expect(normalizeHouseholdServingsSetting({ mode: "family", servings: 8 })).toEqual({
      mode: "family",
      servings: null,
    });
    expect(normalizeHouseholdServingsSetting({ mode: "fixed", servings: 8 })).toEqual({
      mode: "fixed",
      servings: 8,
    });
    expect(recipeYieldServings(null)).toBe(4);
    expect(
      recipeServingsPresentation({
        recipeServings: 4,
        familySize: 8,
        mode: "family",
      })
    ).toEqual({
      storedServings: 4,
      displayServings: 8,
      scaledNote: "Scaled to 8 for your family",
    });
  });
});
