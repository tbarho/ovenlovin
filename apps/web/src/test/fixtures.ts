import type {
  Cookbook,
  Person,
  PersonRule,
  Preference,
  Recipe,
  RecipeDetails,
} from "@ovenlovin/core";

const NOW = "2026-01-01T00:00:00.000Z";
const HOUSEHOLD_ID = "00000000-0000-4000-8000-000000000001";
const USER_ID = "00000000-0000-4000-8000-000000000002";

export function testPerson(overrides: Partial<Person> = {}): Person {
  return {
    id: "00000000-0000-4000-8000-000000000010",
    householdId: HOUSEHOLD_ID,
    displayName: "Parent A",
    sortOrder: 0,
    createdAt: NOW,
    updatedAt: NOW,
    createdBy: USER_ID,
    ...overrides,
  };
}

export function testPersonRule(overrides: Partial<PersonRule> = {}): PersonRule {
  return {
    id: "00000000-0000-4000-8000-000000000011",
    personId: "00000000-0000-4000-8000-000000000010",
    kind: "allergen",
    target: "tree_nut",
    severity: "block",
    includeMayContain: true,
    includeCrossContact: true,
    sharedFacility: "warn",
    includeUnmappedIngredients: false,
    includeDescendants: true,
    treatCoconutAsTreeNut: false,
    label: null,
    note: null,
    setBy: USER_ID,
    createdAt: NOW,
    updatedAt: NOW,
    createdBy: USER_ID,
    ...overrides,
  };
}

export function testPreference(overrides: Partial<Preference> = {}): Preference {
  return {
    id: "00000000-0000-4000-8000-000000000015",
    personId: "00000000-0000-4000-8000-000000000010",
    type: "love",
    value: "salmon",
    weight: 1,
    createdAt: NOW,
    updatedAt: NOW,
    createdBy: USER_ID,
    ...overrides,
  };
}

export function testCookbook(overrides: Partial<Cookbook> = {}): Cookbook {
  return {
    id: "00000000-0000-4000-8000-000000000020",
    householdId: HOUSEHOLD_ID,
    name: "Weeknight dinners",
    slug: "weeknight-dinners",
    visibility: "private",
    sortOrder: 0,
    createdAt: NOW,
    updatedAt: NOW,
    createdBy: USER_ID,
    ...overrides,
  };
}

export function testRecipe(overrides: Partial<Recipe> = {}): Recipe {
  return {
    id: "00000000-0000-4000-8000-000000000030",
    householdId: HOUSEHOLD_ID,
    title: "Pasta",
    slug: "pasta",
    servings: 4,
    prepTimeMinutes: 10,
    cookTimeMinutes: 20,
    methodTags: [],
    equipment: [],
    images: [],
    status: "published",
    visibility: "private",
    version: 1,
    isFamilyRecipe: false,
    createdAt: NOW,
    updatedAt: NOW,
    createdBy: USER_ID,
    ...overrides,
  };
}

export function testRecipeDetails(overrides: Partial<RecipeDetails> = {}): RecipeDetails {
  const recipe = testRecipe(overrides);
  return {
    ...recipe,
    ingredients: [
      {
        id: "00000000-0000-4000-8000-000000000031",
        recipeId: recipe.id,
        order: 0,
        rawText: "8 oz pasta",
        isOptional: false,
        createdAt: NOW,
        updatedAt: NOW,
      },
    ],
    steps: [
      {
        id: "00000000-0000-4000-8000-000000000032",
        recipeId: recipe.id,
        order: 0,
        text: "Boil water.",
        timers: [],
        referencedIngredientIds: [],
        createdAt: NOW,
        updatedAt: NOW,
      },
    ],
    source: null,
    cookbooks: [],
    nutrition: null,
    ...overrides,
  };
}
