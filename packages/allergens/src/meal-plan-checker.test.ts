import { describe, it, expect } from "vitest";
import type { PersonRule } from "@ovenlovin/core";
import {
  checkMealPlan,
  type MealPlanCheckInput,
  type PersonWithRules,
  type MealPlanEntryInput,
} from "./meal-plan-checker";

// Helper to create a test person rule
function createRule(overrides: Partial<PersonRule> = {}): PersonRule {
  return {
    id: overrides.id || "rule-1",
    personId: overrides.personId || "person-1",
    kind: overrides.kind || "allergen",
    target: overrides.target || "peanut",
    severity: overrides.severity || "block",
    includeMayContain: overrides.includeMayContain ?? false,
    includeCrossContact: overrides.includeCrossContact ?? false,
    sharedFacility: overrides.sharedFacility || "ignore",
    includeUnmappedIngredients: overrides.includeUnmappedIngredients ?? false,
    includeDescendants: overrides.includeDescendants ?? true,
    treatCoconutAsTreeNut: overrides.treatCoconutAsTreeNut ?? true,
    label: overrides.label ?? null,
    note: overrides.note ?? null,
    activeFrom: overrides.activeFrom ?? null,
    activeUntil: overrides.activeUntil ?? null,
    setBy: overrides.setBy || "admin-1",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    createdBy: "admin-1",
    deletedAt: null,
  };
}

describe("checkMealPlan", () => {
  it("checks a simple meal plan with one entry", () => {
    const childA: PersonWithRules = {
      id: "child-a",
      name: "Child A",
      rules: [createRule({ personId: "child-a", target: "peanut", severity: "block" })],
    };

    const entry: MealPlanEntryInput = {
      id: "entry-1",
      date: "2026-10-13",
      mealSlot: "lunch",
      recipeId: "recipe-1",
      recipeTitle: "PB&J Sandwich",
      attendees: ["child-a"],
      ingredients: [{ name: "peanut butter" }, { name: "jelly" }, { name: "bread" }],
    };

    const input: MealPlanCheckInput = {
      entries: [entry],
      people: [childA],
    };

    const result = checkMealPlan(input);

    expect(result.status).toBe("complete");
    expect(result.byEntry).toHaveLength(1);
    expect(result.byEntry[0]?.findings.block.length).toBeGreaterThan(0);
    expect(result.byPerson).toHaveLength(1);
    expect(result.byPerson[0]?.findings.block.length).toBeGreaterThan(0);
  });

  it("checks multiple entries with different attendees", () => {
    const childA: PersonWithRules = {
      id: "child-a",
      name: "Child A",
      rules: [createRule({ personId: "child-a", target: "peanut", severity: "block" })],
    };

    const childB: PersonWithRules = {
      id: "child-b",
      name: "Child B",
      rules: [
        createRule({
          personId: "child-b",
          target: "tree_nut",
          severity: "warn",
          includeDescendants: true,
        }),
      ],
    };

    const entry1: MealPlanEntryInput = {
      id: "entry-1",
      date: "2026-10-13",
      mealSlot: "breakfast",
      recipeTitle: "Oatmeal",
      attendees: ["child-a", "child-b"],
      ingredients: [{ name: "oats" }, { name: "milk" }, { name: "honey" }],
    };

    const entry2: MealPlanEntryInput = {
      id: "entry-2",
      date: "2026-10-13",
      mealSlot: "lunch",
      recipeTitle: "PB&J",
      attendees: ["child-a"],
      ingredients: [{ name: "peanut butter" }, { name: "jelly" }],
    };

    const entry3: MealPlanEntryInput = {
      id: "entry-3",
      date: "2026-10-13",
      mealSlot: "dinner",
      recipeTitle: "Pasta with Pesto",
      attendees: ["child-b"],
      ingredients: [{ name: "pasta" }, { name: "pesto" }],
    };

    const input: MealPlanCheckInput = {
      entries: [entry1, entry2, entry3],
      people: [childA, childB],
    };

    const result = checkMealPlan(input);

    expect(result.status).toBe("complete");
    expect(result.byEntry).toHaveLength(3);
    expect(result.summary.totalEntries).toBe(3);
    expect(result.summary.totalPeople).toBe(2);

    // Entry 1 (oatmeal) should have no findings
    expect(result.byEntry[0]?.findings.block).toHaveLength(0);
    expect(result.byEntry[0]?.findings.warn).toHaveLength(0);

    // Entry 2 (PB&J) should have block for child A
    expect(result.byEntry[1]?.findings.block.length).toBeGreaterThan(0);
    expect(result.byEntry[1]?.affectedPeople).toContain("child-a");

    // Entry 3 (pesto) should have warn for child B (pesto contains pine nuts)
    expect(result.byEntry[2]?.findings.warn.length).toBeGreaterThan(0);
    expect(result.byEntry[2]?.affectedPeople).toContain("child-b");
  });

  it("groups findings by person correctly", () => {
    const childA: PersonWithRules = {
      id: "child-a",
      name: "Child A",
      rules: [createRule({ personId: "child-a", target: "peanut", severity: "block" })],
    };

    const entry1: MealPlanEntryInput = {
      id: "entry-1",
      date: "2026-10-13",
      mealSlot: "breakfast",
      recipeTitle: "Peanut Butter Toast",
      attendees: ["child-a"],
      ingredients: [{ name: "peanut butter" }, { name: "bread" }],
    };

    const entry2: MealPlanEntryInput = {
      id: "entry-2",
      date: "2026-10-13",
      mealSlot: "lunch",
      recipeTitle: "Satay Chicken",
      attendees: ["child-a"],
      ingredients: [{ name: "chicken" }, { name: "satay sauce" }],
    };

    const input: MealPlanCheckInput = {
      entries: [entry1, entry2],
      people: [childA],
    };

    const result = checkMealPlan(input);

    expect(result.byPerson).toHaveLength(1);
    const personResult = result.byPerson[0]!;
    expect(personResult.personId).toBe("child-a");
    expect(personResult.findings.block.length).toBeGreaterThan(0);
    expect(personResult.affectedEntries).toHaveLength(2);
    expect(personResult.affectedEntries).toContain("entry-1");
    expect(personResult.affectedEntries).toContain("entry-2");
  });

  it("calculates summary statistics correctly", () => {
    const childA: PersonWithRules = {
      id: "child-a",
      name: "Child A",
      rules: [createRule({ personId: "child-a", target: "peanut", severity: "block" })],
    };

    const childB: PersonWithRules = {
      id: "child-b",
      name: "Child B",
      rules: [createRule({ personId: "child-b", target: "almond", severity: "warn" })],
    };

    const entry1: MealPlanEntryInput = {
      id: "entry-1",
      date: "2026-10-13",
      mealSlot: "breakfast",
      recipeTitle: "Oatmeal",
      attendees: ["child-a", "child-b"],
      ingredients: [{ name: "oats" }],
    };

    const entry2: MealPlanEntryInput = {
      id: "entry-2",
      date: "2026-10-13",
      mealSlot: "lunch",
      recipeTitle: "PB&J",
      attendees: ["child-a"],
      ingredients: [{ name: "peanut butter" }],
    };

    const entry3: MealPlanEntryInput = {
      id: "entry-3",
      date: "2026-10-13",
      mealSlot: "snack",
      recipeTitle: "Almond Bar",
      attendees: ["child-b"],
      ingredients: [{ name: "almonds" }],
    };

    const input: MealPlanCheckInput = {
      entries: [entry1, entry2, entry3],
      people: [childA, childB],
    };

    const result = checkMealPlan(input);

    expect(result.summary.totalEntries).toBe(3);
    expect(result.summary.totalPeople).toBe(2);
    expect(result.summary.entriesWithBlocks).toBe(1);
    expect(result.summary.entriesWithWarnings).toBe(1);
    expect(result.summary.peopleWithBlocks).toBe(1);
    expect(result.summary.peopleWithWarnings).toBe(1);
  });

  it("handles entries with no attendees", () => {
    const childA: PersonWithRules = {
      id: "child-a",
      name: "Child A",
      rules: [createRule({ personId: "child-a", target: "peanut", severity: "block" })],
    };

    const entry: MealPlanEntryInput = {
      id: "entry-1",
      date: "2026-10-13",
      mealSlot: "lunch",
      recipeTitle: "Mystery Meal",
      attendees: [],
      ingredients: [{ name: "peanut butter" }],
    };

    const input: MealPlanCheckInput = {
      entries: [entry],
      people: [childA],
    };

    const result = checkMealPlan(input);

    expect(result.status).toBe("complete");
    expect(result.byEntry).toHaveLength(0);
  });

  it("reports incomplete when entry has no ingredients", () => {
    const childA: PersonWithRules = {
      id: "child-a",
      name: "Child A",
      rules: [createRule({ personId: "child-a", target: "peanut", severity: "block" })],
    };

    const entry: MealPlanEntryInput = {
      id: "entry-1",
      date: "2026-10-13",
      mealSlot: "lunch",
      recipeTitle: "Empty Recipe",
      attendees: ["child-a"],
      ingredients: [],
    };

    const input: MealPlanCheckInput = {
      entries: [entry],
      people: [childA],
    };

    const result = checkMealPlan(input);

    expect(result.status).toBe("incomplete");
    expect(result.incompleteReasons).toBeDefined();
    expect(result.incompleteReasons?.length).toBeGreaterThan(0);
  });

  it("handles multiple severity levels in one entry", () => {
    const child: PersonWithRules = {
      id: "child-a",
      name: "Child A",
      rules: [
        createRule({
          id: "rule-1",
          personId: "child-a",
          target: "peanut",
          severity: "block",
        }),
        createRule({
          id: "rule-2",
          personId: "child-a",
          target: "almond",
          severity: "warn",
        }),
        createRule({
          id: "rule-3",
          personId: "child-a",
          target: "coconut",
          severity: "prefer_avoid",
        }),
      ],
    };

    const entry: MealPlanEntryInput = {
      id: "entry-1",
      date: "2026-10-13",
      mealSlot: "snack",
      recipeTitle: "Trail Mix",
      attendees: ["child-a"],
      ingredients: [{ name: "peanuts" }, { name: "almonds" }, { name: "coconut flakes" }],
    };

    const input: MealPlanCheckInput = {
      entries: [entry],
      people: [child],
    };

    const result = checkMealPlan(input);

    expect(result.byEntry[0]?.findings.block.length).toBeGreaterThan(0);
    expect(result.byEntry[0]?.findings.warn.length).toBeGreaterThan(0);
    expect(result.byEntry[0]?.findings.prefer_avoid.length).toBeGreaterThan(0);
  });

  it("tracks affected people per entry", () => {
    const childA: PersonWithRules = {
      id: "child-a",
      name: "Child A",
      rules: [createRule({ personId: "child-a", target: "peanut", severity: "block" })],
    };

    const childB: PersonWithRules = {
      id: "child-b",
      name: "Child B",
      rules: [createRule({ personId: "child-b", target: "almond", severity: "warn" })],
    };

    const entry: MealPlanEntryInput = {
      id: "entry-1",
      date: "2026-10-13",
      mealSlot: "snack",
      recipeTitle: "Mixed Nuts",
      attendees: ["child-a", "child-b"],
      ingredients: [{ name: "peanuts" }, { name: "almonds" }],
    };

    const input: MealPlanCheckInput = {
      entries: [entry],
      people: [childA, childB],
    };

    const result = checkMealPlan(input);

    expect(result.byEntry[0]?.affectedPeople).toHaveLength(2);
    expect(result.byEntry[0]?.affectedPeople).toContain("child-a");
    expect(result.byEntry[0]?.affectedPeople).toContain("child-b");
  });

  it("tracks affected entries per person", () => {
    const child: PersonWithRules = {
      id: "child-a",
      name: "Child A",
      rules: [
        createRule({
          personId: "child-a",
          target: "tree_nut",
          severity: "block",
          includeDescendants: true,
        }),
      ],
    };

    const entry1: MealPlanEntryInput = {
      id: "entry-1",
      date: "2026-10-13",
      mealSlot: "breakfast",
      recipeTitle: "Almond Granola",
      attendees: ["child-a"],
      ingredients: [{ name: "almonds" }, { name: "oats" }],
    };

    const entry2: MealPlanEntryInput = {
      id: "entry-2",
      date: "2026-10-13",
      mealSlot: "lunch",
      recipeTitle: "Pasta",
      attendees: ["child-a"],
      ingredients: [{ name: "pasta" }],
    };

    const entry3: MealPlanEntryInput = {
      id: "entry-3",
      date: "2026-10-13",
      mealSlot: "dinner",
      recipeTitle: "Pesto Chicken",
      attendees: ["child-a"],
      ingredients: [{ name: "chicken" }, { name: "pesto" }],
    };

    const input: MealPlanCheckInput = {
      entries: [entry1, entry2, entry3],
      people: [child],
    };

    const result = checkMealPlan(input);

    expect(result.byPerson[0]?.affectedEntries).toHaveLength(2);
    expect(result.byPerson[0]?.affectedEntries).toContain("entry-1");
    expect(result.byPerson[0]?.affectedEntries).toContain("entry-3");
    expect(result.byPerson[0]?.affectedEntries).not.toContain("entry-2");
  });

  it("handles freeform meals", () => {
    const child: PersonWithRules = {
      id: "child-a",
      name: "Child A",
      rules: [createRule({ personId: "child-a", target: "peanut", severity: "block" })],
    };

    const entry: MealPlanEntryInput = {
      id: "entry-1",
      date: "2026-10-13",
      mealSlot: "lunch",
      freeformMeal: "Leftovers",
      attendees: ["child-a"],
      ingredients: [{ name: "mixed vegetables" }],
    };

    const input: MealPlanCheckInput = {
      entries: [entry],
      people: [child],
    };

    const result = checkMealPlan(input);

    expect(result.status).toBe("complete");
    expect(result.byEntry[0]?.freeformMeal).toBe("Leftovers");
  });
});
