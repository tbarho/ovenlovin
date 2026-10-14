import { describe, expect, it } from "vitest";
import type { MealPlanEntry } from "../schemas/plans";
import {
  KITCHEN_STAPLES_SECTION,
  ShoppingListService,
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

  it("uses a 4-serving default when the recipe card has no yield", () => {
    expect(servingsScale(6, null, 1)).toBe(1.5);
    expect(servingsScale(4, null, 1)).toBe(1);
  });

  it("falls back to scaleFactor only when the entry has no servings", () => {
    expect(servingsScale(null, 4, 2)).toBe(2);
    expect(servingsScale(undefined, null, 1)).toBe(1);
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

  it("S4: scales quantities by plan entry servings over recipe servings", () => {
    const list = build([
      {
        entry: entry({ recipeId: "ziti", servings: 6 }),
        recipeTitle: "Baked ziti",
        recipeServings: 4,
        ingredients: [{ rawText: "1 lb ziti" }],
      },
    ]);

    expect(list.ingredients[0]).toMatchObject({ name: "ziti", quantity: 1.5, unit: "lb" });
  });

  it("agrees with a stored scaleFactor computed as entry servings / recipe servings", () => {
    const list = build([
      {
        entry: entry({ recipeId: "salmon", servings: 8, scaleFactor: 2 }),
        recipeTitle: "Sheet-pan salmon",
        recipeServings: 4,
        ingredients: [{ rawText: "1 lb broccoli florets" }],
      },
    ]);

    expect(list.ingredients[0]).toMatchObject({
      name: "broccoli florets",
      quantity: 2,
      unit: "lb",
    });
  });

  it("scales REST plan entries that persist scaleFactor 1 and only set servings", () => {
    const list = build([
      {
        entry: entry({ recipeId: "salmon", servings: 8, scaleFactor: 1 }),
        recipeTitle: "Sheet-pan salmon",
        recipeServings: 4,
        ingredients: [{ rawText: "1 lb broccoli florets" }],
      },
    ]);

    expect(list.ingredients[0]).toMatchObject({
      name: "broccoli florets",
      quantity: 2,
      unit: "lb",
    });
  });

  it("scales REST servings when the recipe card has no servings", () => {
    const list = build([
      {
        entry: entry({ recipeId: "imported", servings: 8, scaleFactor: 1 }),
        recipeTitle: "Imported taco pasta",
        recipeServings: null,
        ingredients: [{ rawText: "12 oz pasta" }],
      },
    ]);

    expect(list.ingredients[0]).toMatchObject({ name: "pasta", quantity: 24, unit: "oz" });
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
    ).toEqual(["carrots", "yellow onion"]);

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
    ).toEqual(["chicken thighs", "salmon fillets"]);
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
    expect(list.ingredients[0]).toMatchObject({ name: "salt", quantity: 1.6667, unit: "tbsp" });
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
    expect(withoutStaples.ingredients.map((item) => item.name)).toEqual(["yellow onion"]);
    expect(withoutStaples.itemCount).toBe(1);

    const withStaples = build(entries, { includeStaples: true });
    expect(withStaples.includeStaples).toBe(true);
    expect(withStaples.includePantryItems).toBe(true);
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
    expect(service.format(list, "json")).toBe(service.exportAsJSON(list));
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
    expect(markdown).toContain("1 yellow onion");
    expect(markdown).not.toContain("## Ingredients");
  });
});
