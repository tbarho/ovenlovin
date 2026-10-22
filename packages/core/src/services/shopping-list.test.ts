import { describe, expect, it } from "vitest";
import type { MealPlanEntry } from "../schemas/plans";
import { DECIMAL_TWO_THIRDS_CELERY } from "../scaling/quantity-display.fixture";
import {
  KITCHEN_STAPLES_SECTION,
  ShoppingListService,
  applyShoppingTrip,
  formatShoppingListGeneratedAt,
  resolveIncludeStaples,
  servingsScale,
} from "./shopping-list";

const service = new ShoppingListService();

function entry(overrides: Partial<MealPlanEntry> = {}): MealPlanEntry {
  return {
    id: overrides.id ?? "entry-1",
    createdAt: "2026-10-12T00:00:00.000Z",
    updatedAt: "2026-10-12T00:00:00.000Z",
    deletedAt: null,
    mealPlanId: "plan-1",
    date: "2026-10-12",
    mealSlot: "dinner",
    recipeId: overrides.recipeId ?? "recipe-a",
    freeformMeal: null,
    servings: overrides.servings ?? 4,
    attendees: [],
    scaleFactor: overrides.scaleFactor ?? 1,
    prepAheadNotes: null,
    leftoverSourceId: null,
    ...overrides,
  };
}

function build(
  entries: Parameters<ShoppingListService["build"]>[0]["entries"],
  options: Partial<Parameters<ShoppingListService["build"]>[0]> = {}
) {
  return service.build({
    mealPlanId: "plan-1",
    weekStart: "2026-10-12",
    generatedAt: "2026-10-14T00:00:00.000Z",
    entries,
    ...options,
  });
}

describe("resolveIncludeStaples", () => {
  it("prefers includeStaples over the includePantryItems alias", () => {
    expect(resolveIncludeStaples({})).toBe(false);
    expect(resolveIncludeStaples({ includeStaples: true })).toBe(true);
    expect(resolveIncludeStaples({ includePantryItems: true })).toBe(true);
    expect(resolveIncludeStaples({ includeStaples: false, includePantryItems: true })).toBe(false);
  });
});

describe("servingsScale", () => {
  it("scales plan entry servings relative to recipe servings even when scaleFactor is 1", () => {
    expect(servingsScale(6, 4, 1)).toBe(1.5);
    expect(servingsScale(8, 4, 1)).toBe(2);
    expect(servingsScale(6, 6, 1)).toBe(1);
  });

  it("does not guess a 4-serving card when the recipe has no yield", () => {
    expect(servingsScale(6, null, 1)).toBe(1);
    expect(servingsScale(4, null, 1)).toBe(1);
    expect(servingsScale(8, null, 1, 8)).toBe(1);
  });

  it("falls back to scaleFactor only when the entry has no servings", () => {
    expect(servingsScale(null, 4, 2)).toBe(2);
    expect(servingsScale(undefined, null, 1)).toBe(1);
  });

  it("scales to the week cook-for when the entry has no servings", () => {
    expect(servingsScale(null, 6, 1, 5)).toBe(0.8333);
  });

  it("honors a stored scaleFactor before cook-for when the entry has no servings", () => {
    expect(servingsScale(null, 4, 2, 5)).toBe(2);
  });

  it("uses recipe yield in recipe mode when the entry has no servings", () => {
    expect(servingsScale(null, 6, 1, 4, "recipe")).toBe(1);
  });
});

describe("ShoppingListService", () => {
  it("S1/S5: merges identical items across recipes using the parsed name", () => {
    const list = build(
      [
        {
          entry: entry({ recipeId: "pesto", servings: 4 }),
          recipeTitle: "Weeknight pesto pasta",
          recipeServings: 4,
          ingredients: [{ rawText: "2 tbsp olive oil" }],
        },
        {
          entry: entry({ id: "entry-2", recipeId: "salmon", servings: 4 }),
          recipeTitle: "Sheet-pan salmon",
          recipeServings: 4,
          ingredients: [{ rawText: "3 tbsp olive oil" }],
        },
      ],
      { includeStaples: true }
    );

    const oil = list.ingredients.find((item) => item.name === "olive oil");
    expect(oil).toMatchObject({ quantity: 5, unit: "tbsp" });
    expect(oil?.recipes.map((recipe) => recipe.recipeTitle)).toEqual([
      "Weeknight pesto pasta",
      "Sheet-pan salmon",
    ]);
    expect(list.itemCount).toBe(1);
  });

  it("S3: does not double a single-recipe quantity", () => {
    const list = build([
      {
        entry: entry({ recipeId: "tacos", servings: 4 }),
        recipeTitle: "Veggie tacos",
        recipeServings: 4,
        ingredients: [{ rawText: "1 acorn squash" }],
      },
    ]);

    expect(list.ingredients).toEqual([
      expect.objectContaining({
        name: "acorn squash",
        quantity: 1,
        recipes: [expect.objectContaining({ recipeTitle: "Veggie tacos", quantity: 1 })],
      }),
    ]);
  });

  it("S3: two 1 tsp salt lines become 2 tsp, not 3", () => {
    const list = build(
      [
        {
          entry: entry({ recipeId: "salmon", servings: 4 }),
          recipeTitle: "Sheet-pan salmon",
          recipeServings: 4,
          ingredients: [{ rawText: "1 tsp salt" }],
        },
        {
          entry: entry({ id: "entry-2", recipeId: "ziti", servings: 4 }),
          recipeTitle: "Baked ziti",
          recipeServings: 4,
          ingredients: [{ rawText: "1 tsp salt" }],
        },
      ],
      { includeStaples: true }
    );

    expect(list.ingredients[0]).toMatchObject({ name: "salt", quantity: 2, unit: "tsp" });
  });

  it("S4: scales quantities to the week cook-for, not a leftover per-night stamp", () => {
    const list = build(
      [
        {
          entry: entry({ recipeId: "ziti", servings: 6 }),
          recipeTitle: "Baked ziti",
          recipeServings: 4,
          ingredients: [{ rawText: "1 lb ziti" }],
        },
      ],
      { defaultCookFor: 6 }
    );

    expect(list.ingredients[0]).toMatchObject({ name: "ziti", quantity: 1.5, unit: "lb" });

    const leftoverNight = build([
      {
        entry: entry({ recipeId: "ziti", servings: 6 }),
        recipeTitle: "Baked ziti",
        recipeServings: 4,
        ingredients: [{ rawText: "1 lb ziti" }],
      },
    ]);
    expect(leftoverNight.ingredients[0]).toMatchObject({ name: "ziti", quantity: 1, unit: "lb" });
  });

  it("agrees with a stored scaleFactor computed as entry servings / recipe servings", () => {
    const list = build(
      [
        {
          entry: entry({ recipeId: "salmon", servings: 8, scaleFactor: 2 }),
          recipeTitle: "Sheet-pan salmon",
          recipeServings: 4,
          ingredients: [{ rawText: "1 lb broccoli florets" }],
        },
      ],
      { defaultCookFor: 8 }
    );

    expect(list.ingredients[0]).toMatchObject({
      name: "broccoli florets",
      quantity: 2,
      unit: "lb",
    });
  });

  it("scales REST plan entries that persist scaleFactor 1 and only set servings", () => {
    const list = build(
      [
        {
          entry: entry({ recipeId: "salmon", servings: 8, scaleFactor: 1 }),
          recipeTitle: "Sheet-pan salmon",
          recipeServings: 4,
          ingredients: [{ rawText: "1 lb broccoli florets" }],
        },
      ],
      { defaultCookFor: 8 }
    );

    expect(list.ingredients[0]).toMatchObject({
      name: "broccoli florets",
      quantity: 2,
      unit: "lb",
    });
  });

  it("leaves unknown-yield recipes unscaled", () => {
    const list = build(
      [
        {
          entry: entry({ recipeId: "imported", servings: 8, scaleFactor: 1 }),
          recipeTitle: "Imported taco pasta",
          recipeServings: null,
          ingredients: [{ rawText: "12 oz pasta" }],
        },
      ],
      { defaultCookFor: 8 }
    );

    expect(list.ingredients[0]).toMatchObject({ name: "pasta", quantity: 12, unit: "oz" });
  });

  it("adds amounts when the same food lands on the incompatible-unit fallback key", () => {
    const list = build([
      {
        entry: entry({ recipeId: "soup", servings: 4 }),
        recipeTitle: "Onion soup",
        recipeServings: 4,
        ingredients: [{ rawText: "1 onion" }, { rawText: "1 lb onion" }, { rawText: "2 lb onion" }],
      },
    ]);
    expect(list.ingredients.find((item) => item.unit === "lb")).toMatchObject({
      name: "onion",
      quantity: 3,
      unit: "lb",
    });
    expect(list.ingredients.find((item) => item.unit == null)).toMatchObject({
      name: "onion",
      quantity: 1,
    });
  });

  it("merges convertible units (tsp + tbsp)", () => {
    const list = build(
      [
        {
          entry: entry({ recipeId: "a", servings: 4 }),
          recipeTitle: "A",
          recipeServings: 4,
          ingredients: [{ rawText: "2 tsp olive oil" }],
        },
        {
          entry: entry({ id: "entry-2", recipeId: "b", servings: 4 }),
          recipeTitle: "B",
          recipeServings: 4,
          ingredients: [{ rawText: "1 tbsp olive oil" }],
        },
      ],
      { includeStaples: true }
    );

    expect(list.ingredients[0]).toMatchObject({
      name: "olive oil",
      quantity: 1.6667,
      unit: "tbsp",
      displayQuantity: "1 2/3",
      displayUnit: "tbsp",
    });
  });

  it("S2: groupBy aisle uses store sections; category uses a food taxonomy", () => {
    const entries = [
      {
        entry: entry({ recipeId: "a", servings: 4 }),
        recipeTitle: "A",
        recipeServings: 4,
        ingredients: [
          { rawText: "1 yellow onion" },
          { rawText: "4 carrots" },
          { rawText: "1 lb chicken thighs" },
          { rawText: "4 salmon fillets" },
          { rawText: "2 cups all-purpose flour" },
        ],
      },
    ];

    const byAisle = build(entries, { groupBy: "aisle" });
    expect(byAisle.sections.map((section) => section.name).sort()).toEqual([
      "Baking",
      "Meat",
      "Produce",
      "Seafood",
    ]);
    expect(
      byAisle.sections.find((section) => section.name === "Produce")?.items.map((item) => item.name)
    ).toEqual(["carrot", "onion"]);

    const byCategory = build(entries, { groupBy: "category" });
    expect(byCategory.sections.map((section) => section.name).sort()).toEqual([
      "Pantry",
      "Produce",
      "Protein",
    ]);
    expect(
      byCategory.sections
        .find((section) => section.name === "Protein")
        ?.items.map((item) => item.name)
    ).toEqual(["chicken thigh", "salmon"]);
  });

  it("merges kosher salt, sea salt, and salt under salt", () => {
    const list = build(
      [
        {
          entry: entry({ recipeId: "a", servings: 4 }),
          recipeTitle: "A",
          recipeServings: 4,
          ingredients: [{ rawText: "1 tsp salt" }],
        },
        {
          entry: entry({ id: "entry-2", recipeId: "b", servings: 4 }),
          recipeTitle: "B",
          recipeServings: 4,
          ingredients: [{ rawText: "1 tbsp kosher salt" }],
        },
        {
          entry: entry({ id: "entry-3", recipeId: "c", servings: 4 }),
          recipeTitle: "C",
          recipeServings: 4,
          ingredients: [{ rawText: "1 tsp sea salt" }],
        },
      ],
      { includeStaples: true }
    );

    expect(list.ingredients).toHaveLength(1);
    expect(list.ingredients[0]).toMatchObject({
      name: "salt",
      quantity: 1.6667,
      unit: "tbsp",
      displayQuantity: "1 2/3",
      displayUnit: "tbsp",
    });
  });

  it("exposes friendly display fields for ugly merged spoon amounts", () => {
    const list = build(
      [
        {
          entry: entry({ recipeId: "ziti", servings: 4 }),
          recipeTitle: "Baked ziti",
          recipeServings: 4,
          ingredients: [{ rawText: "2 tsp salt" }],
        },
        {
          entry: entry({ id: "entry-2", recipeId: "salmon", servings: 4 }),
          recipeTitle: "Sheet-pan salmon",
          recipeServings: 4,
          ingredients: [{ rawText: "0.5 tsp salt" }],
        },
        {
          entry: entry({ id: "entry-3", recipeId: "roast", servings: 4 }),
          recipeTitle: "Sunday roast",
          recipeServings: 4,
          ingredients: [{ rawText: "1 tbsp salt" }],
        },
      ],
      { includeStaples: true }
    );

    expect(list.ingredients[0]).toMatchObject({
      name: "salt",
      quantity: 1.8333,
      unit: "tbsp",
      displayQuantity: "2",
      displayUnit: "tbsp",
    });
    expect(service.exportAsMarkdown(list)).toContain("2 tbsp salt");
    expect(service.exportAsMarkdown(list)).not.toContain("1.8333");
  });

  it("shows schema.org 2/3 celery as a cooking fraction, including when scaled", () => {
    const list = build([
      {
        entry: entry({ recipeId: "soup", servings: 4 }),
        recipeTitle: "Tomato soup",
        recipeServings: 4,
        ingredients: [DECIMAL_TWO_THIRDS_CELERY],
      },
    ]);
    expect(list.ingredients[0]).toMatchObject({
      name: "celery",
      displayQuantity: "2/3",
      displayUnit: "cup",
    });
    expect(service.exportAsMarkdown(list)).toContain("2/3 cup celery");
    expect(service.exportAsMarkdown(list)).not.toContain("0.666");
    expect(service.exportAsCSV(list)).toContain("2/3");
    expect(service.exportAsCSV(list)).not.toContain("0.666");

    const doubled = build(
      [
        {
          entry: entry({ recipeId: "soup", servings: 8 }),
          recipeTitle: "Tomato soup",
          recipeServings: 4,
          ingredients: [DECIMAL_TWO_THIRDS_CELERY],
        },
      ],
      { defaultCookFor: 8 }
    );
    expect(doubled.ingredients[0]).toMatchObject({
      name: "celery",
      displayQuantity: "1 1/3",
      displayUnit: "cups",
    });
  });

  it("S2: groupBy recipe keeps per-recipe sections", () => {
    const list = build(
      [
        {
          entry: entry({ recipeId: "pesto", servings: 4 }),
          recipeTitle: "Weeknight pesto pasta",
          recipeServings: 4,
          ingredients: [{ rawText: "12 oz pasta" }],
        },
        {
          entry: entry({ id: "entry-2", recipeId: "ziti", servings: 4 }),
          recipeTitle: "Baked ziti",
          recipeServings: 4,
          ingredients: [{ rawText: "1 lb ziti" }],
        },
      ],
      { groupBy: "recipe" }
    );

    expect(list.sections.map((section) => section.name)).toEqual([
      "Baked ziti",
      "Weeknight pesto pasta",
    ]);
  });

  it("S6: includeStaples excludes salt and oil by default and separates them when true", () => {
    const entries = [
      {
        entry: entry({ recipeId: "a", servings: 4 }),
        recipeTitle: "A",
        recipeServings: 4,
        ingredients: [
          { rawText: "1 yellow onion" },
          { rawText: "2 tbsp olive oil" },
          { rawText: "1 tsp salt" },
        ],
      },
    ];

    const withoutStaples = build(entries);
    expect(withoutStaples.includeStaples).toBe(false);
    expect(withoutStaples.includePantryItems).toBe(false);
    expect(withoutStaples.ingredients[0]?.isStaple).toBe(false);
    expect(withoutStaples.ingredients[0]?.isPantryItem).toBe(false);
    expect(withoutStaples.ingredients.map((item) => item.name)).toEqual(["onion"]);
    expect(withoutStaples.itemCount).toBe(1);

    const withStaples = build(entries, { includeStaples: true });
    expect(withStaples.includeStaples).toBe(true);
    expect(withStaples.includePantryItems).toBe(true);
    expect(withStaples.ingredients.find((item) => item.name === "salt")?.isStaple).toBe(true);
    expect(withStaples.ingredients.find((item) => item.name === "salt")?.isPantryItem).toBe(true);
    expect(withStaples.itemCount).toBe(3);
    expect(withStaples.sections.map((section) => section.name).sort()).toEqual([
      KITCHEN_STAPLES_SECTION,
      "Produce",
    ]);
    expect(
      withStaples.sections
        .find((section) => section.name === KITCHEN_STAPLES_SECTION)
        ?.items.map((item) => item.name)
    ).toEqual(["olive oil", "salt"]);
  });

  it("accepts includePantryItems as an alias for includeStaples", () => {
    const entries = [
      {
        entry: entry({ recipeId: "a", servings: 4 }),
        recipeTitle: "A",
        recipeServings: 4,
        ingredients: [{ rawText: "1 tsp salt" }],
      },
    ];

    const viaAlias = build(entries, { includePantryItems: true });
    expect(viaAlias.includeStaples).toBe(true);
    expect(viaAlias.includePantryItems).toBe(true);
    expect(viaAlias.ingredients.map((item) => item.name)).toEqual(["salt"]);

    const canonicalWins = build(entries, { includeStaples: false, includePantryItems: true });
    expect(canonicalWins.includeStaples).toBe(false);
    expect(canonicalWins.ingredients).toEqual([]);
  });

  it("S7: JSON export is the shared core shape used by MCP and REST", () => {
    const list = build([
      {
        entry: entry({ recipeId: "tacos", servings: 4 }),
        recipeTitle: "Veggie tacos",
        recipeServings: 4,
        ingredients: [{ rawText: "1 acorn squash" }],
      },
    ]);

    const parsed = JSON.parse(service.exportAsJSON(list)) as typeof list;
    expect(parsed).toMatchObject({
      mealPlanId: "plan-1",
      weekStart: "2026-10-12",
      groupBy: "aisle",
      includeStaples: false,
      includePantryItems: false,
      itemCount: 1,
      ingredients: [{ name: "acorn squash", quantity: 1 }],
      sections: [{ name: "Produce", items: [{ name: "acorn squash" }] }],
    });
    expect(JSON.parse(service.format(list, "json")).ingredients[0].checked).toBe(false);
  });

  it("markdown lists aisle headings instead of a flat Ingredients section", () => {
    const list = build([
      {
        entry: entry({ recipeId: "a", servings: 4 }),
        recipeTitle: "A",
        recipeServings: 4,
        ingredients: [{ rawText: "1 yellow onion" }],
      },
    ]);
    const markdown = service.exportAsMarkdown(list);
    expect(markdown).toContain("## Produce");
    expect(markdown).toContain("1 onion");
    expect(markdown).toContain("- [ ]");
    expect(markdown).not.toContain("## Ingredients");
  });

  it("stamps a stable check-off key and pluralizes count units on export", () => {
    const list = build([
      {
        entry: entry({ recipeId: "pesto", servings: 4 }),
        recipeTitle: "Weeknight pesto pasta",
        recipeServings: 4,
        ingredients: [{ rawText: "2 cloves garlic" }],
      },
    ]);
    const garlic = list.ingredients.find((item) => item.name === "garlic");
    expect(garlic?.key).toBe("garlic::clove");
    expect(garlic?.displayUnit).toBe("cloves");
    expect(service.exportAsMarkdown(list)).toContain("2 cloves garlic");
    expect(JSON.parse(service.exportAsJSON(list)).ingredients[0].key).toBe("garlic::clove");
    expect(JSON.parse(service.exportAsJSON(list)).ingredients[0].displayUnit).toBe("cloves");
  });

  it("scales every night to the week cook-for, even a 48-serving recipe stored as 48", () => {
    const list = build(
      [
        {
          entry: entry({ recipeId: "batch", servings: 48, scaleFactor: 1 }),
          recipeTitle: "Test Recipe 7A",
          recipeServings: 48,
          ingredients: [{ rawText: "1 cup butter" }, { rawText: "6 eggs" }],
        },
        {
          entry: entry({ id: "entry-2", recipeId: "tacos", servings: 8, scaleFactor: 1 }),
          recipeTitle: "Veggie tacos",
          recipeServings: 4,
          ingredients: [{ rawText: "1 tbsp olive oil" }],
        },
      ],
      { defaultCookFor: 8, includeStaples: true }
    );

    expect(list.scaledFor).toBe(8);
    expect(list.scaledForMixed).toBe(false);
    expect(list.ingredients.find((item) => item.name === "butter")).toMatchObject({
      displayQuantity: "2 3/4",
      displayUnit: "tbsp",
    });
    expect(list.ingredients.find((item) => item.name === "egg")?.quantity).toBeGreaterThan(0);
    expect(list.ingredients.find((item) => item.name === "egg")?.quantity).toBeLessThan(6);
    expect(service.exportAsMarkdown(list)).toContain("For 8 people");
    expect(service.exportAsMarkdown(list)).not.toContain("some recipes scaled differently");
    expect(service.exportAsMarkdown(list)).not.toContain("For 5 people");
  });

  it("names the heading from the week cook-for, not a leftover per-night servings stamp", () => {
    const list = build(
      [
        {
          entry: entry({ recipeId: "roast", servings: 7 }),
          recipeTitle: "Sunday roast",
          recipeServings: 4,
          ingredients: [{ rawText: "1 lb chicken" }],
        },
      ],
      { defaultCookFor: 8 }
    );
    expect(list.scaledFor).toBe(8);
    expect(list.scaledForMixed).toBe(false);
    expect(list.ingredients[0]).toMatchObject({
      name: "chicken",
      displayQuantity: "2",
      displayUnit: "lbs",
    });
    expect(service.exportAsMarkdown(list)).toContain("For 8 people");
    expect(service.exportAsMarkdown(list)).not.toContain("For 7 people");
  });

  it("does not print 0 tsp when a 48-serving pinch of salt is cooked for 5", () => {
    const list = build(
      [
        {
          entry: entry({ recipeId: "batch", servings: 5 }),
          recipeTitle: "Big batch soup",
          recipeServings: 48,
          ingredients: [{ rawText: "1/2 tsp salt" }],
        },
      ],
      { includeStaples: true, defaultCookFor: 5 }
    );
    const text = service.exportAsMarkdown(list);
    expect(text).not.toMatch(/0 tsp/);
    expect(text).toContain("a pinch");
  });

  it("does not show 3/4 lb when 1 lb is scaled from 24 to 23 servings", () => {
    const list = build(
      [
        {
          entry: entry({ recipeId: "roast", servings: 23 }),
          recipeTitle: "Sunday roast",
          recipeServings: 24,
          ingredients: [{ rawText: "1 lb ground beef" }],
        },
      ],
      { defaultCookFor: 23 }
    );
    expect(list.ingredients[0]).toMatchObject({
      name: "ground beef",
      displayQuantity: "1",
      displayUnit: "lb",
    });
    expect(service.exportAsMarkdown(list)).toContain("1 lb ground beef");
    expect(service.exportAsMarkdown(list)).not.toContain("3/4 lb");
  });

  it("rounds countable shop items up and keeps measured cooking fractions", () => {
    const list = build(
      [
        {
          entry: entry({ recipeId: "household-dinner", servings: 5 }),
          recipeTitle: "Household dinner",
          recipeServings: 6,
          ingredients: [{ rawText: "3 eggs" }],
        },
        {
          entry: entry({ id: "entry-2", recipeId: "roast", servings: 4 }),
          recipeTitle: "Sunday roast",
          recipeServings: 6,
          ingredients: [
            { rawText: "1 whole chicken" },
            { rawText: "1 can kidney beans" },
            { rawText: "1 lb ground beef" },
          ],
        },
      ],
      { defaultCookFor: 4 }
    );

    expect(list.ingredients.find((item) => item.name === "egg")).toMatchObject({
      quantity: 3,
      displayQuantity: "3",
    });
    expect(list.ingredients.find((item) => /chicken/i.test(item.name))).toMatchObject({
      quantity: 1,
      displayQuantity: "1",
    });
    expect(list.ingredients.find((item) => item.name === "kidney beans")).toMatchObject({
      quantity: 1,
      unit: "can",
      displayQuantity: "1",
      displayUnit: "can",
    });
    expect(list.ingredients.find((item) => item.name === "ground beef")).toMatchObject({
      displayQuantity: "2/3",
      displayUnit: "lb",
    });
    const markdown = service.exportAsMarkdown(list);
    expect(markdown).toContain("3 eggs");
    expect(markdown).not.toContain("2 1/2");
    expect(markdown).not.toContain("2/3 whole chicken");
    expect(markdown).not.toContain("2/3 can");
  });

  it("merges lemon and lemons onto one shopping line", () => {
    const list = build([
      {
        entry: entry({ recipeId: "salmon", servings: 4 }),
        recipeTitle: "Sheet-pan salmon",
        recipeServings: 4,
        ingredients: [{ rawText: "1 lemon" }],
      },
      {
        entry: entry({ id: "entry-2", recipeId: "chili", servings: 4 }),
        recipeTitle: "Beef chili",
        recipeServings: 4,
        ingredients: [{ rawText: "2 lemons" }],
      },
    ]);

    expect(list.ingredients).toEqual([
      expect.objectContaining({
        name: "lemon",
        quantity: 3,
        displayQuantity: "3",
      }),
    ]);
    expect(list.itemCount).toBe(1);
  });

  it("marks check-offs in list export", () => {
    const list = build([
      {
        entry: entry({ recipeId: "pesto", servings: 4 }),
        recipeTitle: "Weeknight pesto pasta",
        recipeServings: 4,
        ingredients: [{ rawText: "2 cloves garlic" }],
      },
    ]);
    const key = list.ingredients[0]?.key ?? "garlic::clove";
    const markdown = service.format(list, "markdown", { checkedKeys: [key] });
    expect(markdown).toContain("- [x] 2 cloves garlic");
    const parsed = JSON.parse(service.format(list, "json", { checkedKeys: [key] })) as {
      ingredients: Array<{ checked: boolean }>;
    };
    expect(parsed.ingredients[0]?.checked).toBe(true);
  });

  it("applies check-offs and extras to markdown, JSON, and the structured list", () => {
    const list = build([
      {
        entry: entry({ recipeId: "pesto", servings: 4 }),
        recipeTitle: "Weeknight pesto pasta",
        recipeServings: 4,
        ingredients: [{ rawText: "2 eggs" }],
      },
    ]);
    const eggKey = list.ingredients[0]?.key ?? "egg";
    const trip = {
      checkedKeys: [eggKey, "extra-1"],
      extras: [{ key: "extra-1", name: "paper towels" }],
    };
    const marked = applyShoppingTrip(list, trip);
    expect(marked.ingredients.map((item) => item.name).sort()).toEqual(["egg", "paper towels"]);
    expect(marked.ingredients.find((item) => item.name === "egg")?.checked).toBe(true);
    expect(marked.ingredients.find((item) => item.name === "paper towels")?.checked).toBe(true);
    expect(marked.itemCount).toBe(2);

    const markdown = service.format(list, "markdown", trip);
    expect(markdown).toContain("- [x] 2 eggs");
    const dozen = build([
      {
        entry: entry({ recipeId: "bake", servings: 4 }),
        recipeTitle: "Sheet-pan cookies",
        recipeServings: 4,
        ingredients: [{ rawText: "12 eggs" }],
      },
    ]);
    expect(service.exportAsText(dozen)).toMatch(/\b12 eggs\b/);
    expect(service.exportAsText(dozen)).not.toMatch(/\b12 egg\b/);
    expect(markdown).toContain("- [x] paper towels");
    expect(markdown).not.toContain("- [ ] 2 egg");

    const parsed = JSON.parse(service.format(list, "json", trip)) as {
      ingredients: Array<{ name: string; checked?: boolean }>;
    };
    expect(parsed.ingredients).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "egg", checked: true }),
        expect.objectContaining({ name: "paper towels", checked: true }),
      ])
    );
  });

  it("labels Generated with the kitchen timezone", () => {
    const list = build([
      {
        entry: entry({ recipeId: "a", servings: 4 }),
        recipeTitle: "A",
        recipeServings: 4,
        ingredients: [{ rawText: "1 yellow onion" }],
      },
    ]);
    expect(formatShoppingListGeneratedAt(list.generatedAt, "UTC")).toMatch(/UTC/);
    expect(service.exportAsMarkdown(list, { timeZone: "UTC" })).toMatch(/\*\*Generated:\*\*.*UTC/);
    expect(service.exportAsMarkdown(list, { timeZone: "America/Chicago" })).toMatch(
      /\*\*Generated:\*\*.*(CDT|CST)/
    );
    expect(service.exportAsText(list, { timeZone: "UTC" })).toMatch(/Generated: .*UTC/);
  });

  it("Olive W-2 / I-5: one shoppable line per food for a week at 8", () => {
    const list = build(
      [
        {
          entry: entry({ recipeId: "pizza", servings: 8 }),
          recipeTitle: "Sheet-pan pizza",
          recipeServings: 4,
          ingredients: [
            { rawText: "Bell peppers, stems and seeds removed, very thinly sliced" },
            { rawText: "(490 g) bread flour 6 1/4 cups" },
            { rawText: "1 kg / 1 lb chicken breast" },
            { rawText: "2 tbsp olive oil" },
            { rawText: "1/2 cup grated parmesan" },
            { rawText: "1/4 cup parmesan cheese" },
            { rawText: "2 tbsp freshly grated parmesan" },
            { rawText: "parmesan, for serving" },
            { rawText: "3 cloves garlic, minced" },
            { rawText: "2 cloves garlic" },
            { rawText: "minced garlic" },
            { rawText: "1 yellow onion" },
            { rawText: "1 large onion" },
            { rawText: "2 onions" },
            { rawText: "1/2 onion" },
            { rawText: "shrimp" },
            { rawText: "2 lbs shrimp" },
            { rawText: "((Note 1))" },
            { rawText: "chopped fresh parsley, or" },
            { rawText: "Optional: Shredded cheddar cheese, taco sauce, salsa…" },
            { rawText: "1 tbsp EACH cumin, paprika, oregano" },
            { rawText: "2 cups arugula, tossed with olive oil" },
            { rawText: "2 cups chicken stock" },
            { rawText: "1/2 cup butter" },
          ],
        },
        {
          entry: entry({ id: "entry-2", recipeId: "charro", servings: 8, scaleFactor: 1 }),
          recipeTitle: "Charro Beans",
          recipeServings: null,
          ingredients: [
            { rawText: "2 cups butter" },
            { rawText: "2 tbsp olive oil" },
            { rawText: "2 lbs / 360g beef fillet" },
            { rawText: "1/4 cup soy sauce" },
            { rawText: "2 tbsp low-sodium soy sauce" },
            { rawText: "1 tbsp soy sauce" },
          ],
        },
      ],
      { includeStaples: true, defaultCookFor: 8 }
    );
    const markdown = service.exportAsMarkdown(list);
    const byName = Object.fromEntries(list.ingredients.map((item) => [item.name, item]));

    expect(byName["Bell peppers"] ?? byName["bell pepper"]).toMatchObject({
      displayQuantity: "as needed",
      aisle: "Produce",
      isStaple: false,
    });
    expect(
      list.sections.find((section) => section.name === "Produce")?.items.map((item) => item.name)
    ).toEqual(expect.arrayContaining([expect.stringMatching(/bell pepper/i), "arugula"]));
    expect(markdown).toMatch(/as needed bell pepper/i);
    expect(byName["bread flour"]).toMatchObject({
      quantity: 12.5,
      unit: "cup",
      aisle: "Baking",
    });
    expect(byName["chicken breast"]).toMatchObject({
      quantity: 2,
      unit: "kg",
      aisle: "Meat",
    });
    expect(markdown).toContain("chicken breast");
    expect(markdown).not.toMatch(/1 kg \/ 1 lb/);
    expect(byName["beef fillet"]).toMatchObject({ quantity: 2, unit: "lb" });
    expect(byName["olive oil"]?.recipes).toHaveLength(2);
    expect(byName.parmesan?.recipes.length).toBeGreaterThanOrEqual(3);
    expect(list.ingredients.filter((item) => item.name === "parmesan")).toHaveLength(1);
    expect(list.ingredients.filter((item) => item.name === "garlic")).toHaveLength(1);
    expect(byName.garlic).toMatchObject({ quantity: 10, unit: "clove" });
    expect(byName.onion).toMatchObject({ quantity: 9 });
    expect(list.ingredients.filter((item) => item.name === "shrimp")).toHaveLength(1);
    expect(byName.shrimp).toMatchObject({ quantity: 4, unit: "lb" });
    expect(list.ingredients.find((item) => /note/i.test(item.name))).toBeUndefined();
    expect(byName.parsley).toBeTruthy();
    expect(byName["cheddar cheese"] ?? byName.cheddar).toBeTruthy();
    expect(byName["taco sauce"]).toBeTruthy();
    expect(byName.salsa).toBeTruthy();
    expect(byName.cumin).toMatchObject({ quantity: 2, unit: "tbsp" });
    expect(byName.paprika).toMatchObject({ quantity: 2, unit: "tbsp" });
    expect(byName.oregano).toMatchObject({ quantity: 2, unit: "tbsp" });
    expect(byName.arugula).toMatchObject({ aisle: "Produce", quantity: 4, unit: "cup" });
    expect(byName["chicken stock"]).toMatchObject({ aisle: "Pantry", quantity: 4, unit: "cup" });
    expect(byName.butter).toMatchObject({ quantity: 3, unit: "cup" });
    expect(markdown).not.toContain("2 1/2 cups butter");
    expect(list.ingredients.filter((item) => item.name === "soy sauce")).toHaveLength(1);
    expect(markdown).not.toContain("((Note");
  });

  it("keeps tofu and kalamata olives out of Produce", () => {
    const list = build([
      {
        entry: entry({ recipeId: "stir", servings: 4 }),
        recipeTitle: "Tofu stir-fry",
        recipeServings: 4,
        ingredients: [{ rawText: "14 oz extra-firm tofu" }, { rawText: "1/2 cup kalamata olives" }],
      },
    ]);
    expect(list.ingredients.find((item) => item.name.includes("tofu"))?.aisle).toBe("Refrigerated");
    expect(list.ingredients.find((item) => item.name.includes("olive"))?.aisle).toBe(
      "Canned goods"
    );
    expect(list.sections.map((section) => section.name).sort()).toEqual([
      "Canned goods",
      "Refrigerated",
    ]);
  });

  it("rounds counted items up, merges flour, keeps crushed tomatoes, and files plant milk outside Dairy", () => {
    const list = build([
      {
        entry: entry({ recipeId: "a", servings: 4 }),
        recipeTitle: "Cookies",
        recipeServings: 4,
        ingredients: [
          { rawText: "3.75 eggs" },
          { rawText: "2 cups all-purpose flour" },
          { rawText: "1 can crushed tomatoes" },
          { rawText: "1 cup oat milk" },
        ],
      },
      {
        entry: entry({ id: "entry-2", recipeId: "b", servings: 4 }),
        recipeTitle: "Pancakes",
        recipeServings: 4,
        ingredients: [
          { rawText: "2.5 eggs" },
          { rawText: "1 cup flour" },
          { rawText: "0.42 eggs" },
        ],
      },
    ]);
    const eggs = list.ingredients.find((item) => item.name === "egg");
    expect(eggs?.quantity).toBe(7);
    expect(eggs?.displayQuantity).toBe("7");
    expect(service.exportAsMarkdown(list)).toContain("7 eggs");
    expect(list.ingredients.filter((item) => item.name === "all purpose flour")).toHaveLength(1);
    expect(list.ingredients.find((item) => item.name === "flour")).toBeUndefined();
    expect(list.ingredients.find((item) => item.name === "crushed tomatoes")).toMatchObject({
      aisle: "Canned goods",
      unit: "can",
    });
    expect(list.ingredients.find((item) => item.name === "oat milk")?.aisle).not.toBe("Dairy");
    expect(list.ingredients.find((item) => item.name === "tomatoes")).toBeUndefined();
  });

  it.each([
    {
      name: "lemon juiced",
      lines: ["1 lemon, juiced"],
      expectName: /^lemon$/i,
      reject: /juiced|zested/i,
      rows: 1,
    },
    {
      name: "lemons zested and juiced",
      lines: ["2 lemons, zested and juiced"],
      expectName: /^lemon$/i,
      reject: /juiced|zested/i,
      rows: 1,
    },
    {
      name: "unbalanced butter paren",
      lines: ["1 cup unsalted butter)"],
      expectName: /^butter$/i,
      reject: /[()]|unsalted/i,
      rows: 1,
    },
    {
      name: "unbalanced eggs paren",
      lines: ["6 eggs (room temperature))"],
      expectName: /^egg$/i,
      reject: /room temperature|[()]/i,
      rows: 1,
    },
    {
      name: "flour slash",
      lines: ["1 1/8 cups plain / all purpose flour"],
      expectName: /^all purpose flour$/i,
      reject: /^plain$/i,
      rows: 1,
    },
    {
      name: "butter variants",
      lines: ["1 cup butter", "1/2 cup unsalted butter", "2 tbsp salted butter"],
      expectName: /^butter$/i,
      reject: /unsalted|salted/i,
      rows: 1,
      quantity: 1.625,
      unit: "cup",
    },
    {
      name: "parmesan variants",
      lines: ["1/2 cup parmesan", "1/4 cup Parmesan cheese", "2 tbsp parmigiano reggiano"],
      expectName: /^parmesan$/i,
      reject: /cheese|parmigiano/i,
      rows: 1,
    },
    {
      name: "vanilla variants",
      lines: ["1 tsp vanilla", "1 tsp vanilla extract", "1 tsp pure vanilla extract"],
      expectName: /^vanilla$/i,
      reject: /extract|^pure$/i,
      rows: 1,
      quantity: 3,
      unit: "tsp",
    },
    {
      name: "crushed garlic",
      lines: ["3 cloves garlic, crushed", "1 tsp crushed garlic"],
      expectName: /^garlic$/i,
      reject: /^crushed$/i,
      rows: 2,
    },
    {
      name: "almond flour stays",
      lines: ["1 cup almond flour"],
      expectName: /^almond flour$/i,
      reject: /all purpose/i,
      rows: 1,
    },
    {
      name: "crushed tomatoes stay",
      lines: ["1 can crushed tomatoes"],
      expectName: /^crushed tomatoes$/i,
      reject: /^tomatoes$/i,
      rows: 1,
    },
    {
      name: "flaxseed",
      lines: ["1/4 cup flaxseed"],
      expectName: /^flaxseed$/i,
      rows: 1,
    },
    {
      name: "aniseed",
      lines: ["1 tsp aniseed"],
      expectName: /^aniseed$/i,
      rows: 1,
    },
    {
      name: "cream cheese + cream",
      lines: ["8 oz cream cheese", "1 cup cream"],
      expectName: [/^cream cheese$/i, /^cream$/i],
      rows: 2,
    },
    {
      name: "lemon extract + lemon",
      lines: ["1 tsp lemon extract", "1 lemon"],
      expectName: [/lemon extract/i, /^lemon$/i],
      rows: 2,
      aisles: { "lemon extract": "Baking", lemon: "Produce" },
      categories: { "lemon extract": "pantry", lemon: "produce" },
    },
    {
      name: "mint extract + fresh mint",
      lines: ["1 tsp mint extract", "1 bunch fresh mint"],
      expectName: [/mint extract/i, /^mint$/i],
      rows: 2,
      aisles: { "mint extract": "Baking", mint: "Produce" },
      categories: { "mint extract": "pantry", mint: "produce" },
    },
    {
      name: "salt/pepper",
      lines: ["salt/pepper"],
      expectName: [/^salt$/i, /^pepper$/i],
      includeStaples: true,
      rows: 2,
    },
    {
      name: "butter/oil",
      lines: ["butter/oil"],
      expectName: [/^butter$/i, /^oil$/i],
      includeStaples: true,
      rows: 2,
    },
    {
      name: "minced or crushed garlic",
      lines: ["2 cloves garlic, minced or crushed"],
      expectName: /^garlic$/i,
      reject: /minced|crushed|^or /i,
      rows: 1,
    },
    {
      name: "fresh + dried thyme",
      lines: ["1 tbsp fresh thyme", "1 tsp dried thyme"],
      expectName: [/^thyme$/i, /^dried thyme$/i],
      rows: 2,
    },
    {
      name: "onion lb + count",
      lines: ["1 onion", "1 lb onion"],
      expectName: /^onion$/i,
      rows: 2,
    },
    {
      name: "eggs beaten",
      lines: ["4 large eggs, beaten"],
      expectName: /^egg$/i,
      reject: /beaten/i,
      rows: 1,
    },
    {
      name: "lime wedges",
      lines: ["1 lime, cut into wedges"],
      expectName: /^lime$/i,
      reject: /wedge/i,
      rows: 1,
    },
    {
      name: "butter plus more",
      lines: ["2 tbsp butter, plus more for greasing"],
      expectName: /^butter$/i,
      reject: /greasing|plus/i,
      rows: 1,
    },
    {
      name: "broth or water",
      lines: ["1 cup broth, or water"],
      expectName: /^broth$/i,
      reject: /^water$/i,
      rows: 1,
    },
    {
      name: "tomatoes canned",
      lines: ["2 cups tomatoes, canned"],
      expectName: /canned tomatoes/i,
      reject: /^tomatoes$/i,
      rows: 1,
      aisles: { "canned tomatoes": "Canned goods" },
      categories: { "canned tomatoes": "pantry" },
    },
    {
      name: "crushed tomato cup",
      lines: ["1 cup crushed tomato"],
      expectName: /^crushed tomatoes$/i,
      rows: 1,
      aisles: { "crushed tomatoes": "Canned goods" },
      categories: { "crushed tomatoes": "pantry" },
    },
    {
      name: "crushed pineapple cup",
      lines: ["1 cup crushed pineapple"],
      expectName: /^crushed pineapple$/i,
      rows: 1,
      aisles: { "crushed pineapple": "Canned goods" },
      categories: { "crushed pineapple": "pantry" },
    },
    {
      name: "bell pepper red",
      lines: ["bell pepper, red"],
      expectName: /red bell pepper/i,
      reject: /^red$/i,
      rows: 1,
    },
  ])(
    "UAT shop lines $name",
    ({ lines, expectName, reject, rows, includeStaples, aisles, categories, quantity, unit }) => {
      const list = build(
        [
          {
            entry: entry({ recipeId: "uat", servings: 4 }),
            recipeTitle: "UAT",
            recipeServings: 4,
            ingredients: lines.map((rawText) => ({ rawText })),
          },
        ],
        includeStaples ? { includeStaples: true } : {}
      );
      const patterns = Array.isArray(expectName) ? expectName : [expectName];
      const matched = list.ingredients.filter((item) =>
        patterns.some((pattern) => pattern.test(item.name))
      );
      expect(list.ingredients).toHaveLength(rows);
      expect(matched).toHaveLength(rows);
      if (reject) {
        expect(list.ingredients.some((item) => reject.test(item.name))).toBe(false);
      }
      if (aisles) {
        for (const [itemName, aisle] of Object.entries(aisles)) {
          expect(list.ingredients.find((item) => item.name === itemName)?.aisle).toBe(aisle);
        }
      }
      if (categories) {
        for (const [itemName, category] of Object.entries(categories)) {
          expect(list.ingredients.find((item) => item.name === itemName)?.category).toBe(category);
        }
      }
      if (quantity != null) {
        expect(matched[0]?.quantity).toBe(quantity);
        if (unit) expect(matched[0]?.unit).toBe(unit);
      }
    }
  );
});
