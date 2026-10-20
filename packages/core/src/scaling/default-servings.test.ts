import { describe, expect, it } from "vitest";
import {
  cookForPeopleLabel,
  cookForServingsLabel,
  defaultDisplayedServings,
  effectivePlanServings,
  normalizeHouseholdServingsSetting,
  parseServingsQuery,
  planEntryServings,
  presentDisplayedRecipe,
  recipeServingsPresentation,
  recipeYieldServings,
  scaledServingsNote,
  weekDefaultServings,
} from "./default-servings";
import type { RecipeDetails } from "../schemas/recipes";

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

  it("stores the cook-for count for family and fixed plan entries", () => {
    expect(planEntryServings({ recipeServings: 4, cookFor: 8, mode: "family" })).toBe(8);
    expect(planEntryServings({ recipeServings: 10, cookFor: 8, mode: "family" })).toBe(10);
    expect(planEntryServings({ recipeServings: 10, cookFor: 8, mode: "fixed" })).toBe(8);
    expect(planEntryServings({ recipeServings: 10, cookFor: 8, mode: "recipe" })).toBe(10);
  });

  it("uses household Default servings when a plan entry has no servings", () => {
    expect(effectivePlanServings({ entryServings: null, defaultCookFor: 5 })).toBe(5);
    expect(effectivePlanServings({ entryServings: 6, defaultCookFor: 5 })).toBe(6);
    expect(effectivePlanServings({ defaultCookFor: 5 })).toBe(5);
    expect(
      effectivePlanServings({
        entryServings: null,
        defaultCookFor: 5,
        mode: "family",
        recipeServings: 6,
      })
    ).toBe(6);
  });

  it("honors a stored scaleFactor before cook-for when the entry has no servings", () => {
    expect(
      effectivePlanServings({
        entryServings: null,
        defaultCookFor: 5,
        recipeServings: 4,
        scaleFactor: 2,
      })
    ).toBe(8);
  });

  it("uses recipe yield in recipe mode when the entry has no servings", () => {
    expect(
      effectivePlanServings({
        entryServings: null,
        defaultCookFor: 4,
        mode: "recipe",
        recipeServings: 6,
      })
    ).toBe(6);
  });
});

describe("notes and settings", () => {
  it("uses the same cook-for wording on recipes and plan cards", () => {
    expect(cookForServingsLabel({ cookFor: 8, recipeServings: 4 })).toBe(
      "Recipe makes 4 · cooking for 8"
    );
    expect(cookForServingsLabel({ cookFor: 4, recipeServings: 4 })).toBe("4 servings");
    expect(cookForServingsLabel({ cookFor: 1, recipeServings: 1 })).toBe("1 serving");
    expect(cookForServingsLabel({ cookFor: 5 })).toBe("5 servings");
    expect(cookForPeopleLabel(6)).toBe("For 6 people");
    expect(cookForPeopleLabel(1)).toBe("For 1 person");
    expect(cookForPeopleLabel(5, true)).toBe("For 5 people (some recipes at full yield)");
  });

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
    expect(parseServingsQuery("6")).toBe(6);
    expect(parseServingsQuery("nope")).toBeNull();
    expect(
      recipeServingsPresentation({
        recipeServings: 4,
        familySize: 8,
        mode: "family",
        servingsOverride: 6,
      }).displayServings
    ).toBe(6);
  });

  it("scales REST recipe displayText to Default servings or a servings override", () => {
    const recipe = {
      servings: 4,
      ingredients: [
        {
          rawText: "1 lb ground beef",
          quantityMin: 1,
          unit: "lb",
        },
      ],
    } as RecipeDetails;

    const family = presentDisplayedRecipe(recipe, { familySize: 8, mode: "family" });
    expect(family.displayServings).toBe(8);
    expect(family.ingredients[0]?.displayText).toBe("2 lbs ground beef");

    const overridden = presentDisplayedRecipe(recipe, {
      familySize: 8,
      mode: "family",
      servingsOverride: 6,
    });
    expect(overridden.displayServings).toBe(6);
    expect(overridden.ingredients[0]?.displayText).toBe("1 1/2 lbs ground beef");
  });

  it("does not scale amounts when the recipe yield is unknown", () => {
    const recipe = {
      servings: null,
      ingredients: [
        {
          rawText: "1 lb ground beef",
          quantityMin: 1,
          unit: "lb",
        },
      ],
    } as RecipeDetails;

    const family = presentDisplayedRecipe(recipe, { familySize: 8, mode: "family" });
    expect(family.displayServings).toBe(8);
    expect(family.ingredients[0]?.displayText).toBe("1 lb ground beef");
  });
});
