import { describe, expect, it } from "vitest";
import { DEMO_PEOPLE, DEMO_PLAN_DINNERS, DEMO_RECIPES, DEMO_SHOPPING_ITEMS } from "./fixture";

describe("demo kitchen fixture", () => {
  it("has five people with rules and loves", () => {
    expect(DEMO_PEOPLE).toHaveLength(5);
    expect(DEMO_PEOPLE.map((person) => person.displayName)).toEqual([
      "Parent A",
      "Parent B",
      "Child A",
      "Child B",
      "Child C",
    ]);
    expect(DEMO_PEOPLE.every((person) => person.rules.length > 0)).toBe(true);
    expect(DEMO_PEOPLE.every((person) => person.loves.length > 0)).toBe(true);
  });

  it("gives Child C peanut and tree nut blocks", () => {
    const childC = DEMO_PEOPLE.find((person) => person.displayName === "Child C");
    expect(childC?.rules.map((rule) => `${rule.target}:${rule.severity}`)).toEqual([
      "peanut:block",
      "tree_nut:block",
    ]);
  });

  it("includes about 20 recipes with images, ingredients, and two cookbooks", () => {
    expect(DEMO_RECIPES.length).toBeGreaterThanOrEqual(20);
    expect(DEMO_RECIPES.every((recipe) => (recipe.ingredients?.length ?? 0) > 0)).toBe(true);
    expect(DEMO_RECIPES.every((recipe) => recipe.images?.[0]?.startsWith("/demo-kitchen/"))).toBe(
      true
    );
    expect(DEMO_RECIPES.filter((recipe) => recipe.cookbook === "weeknight").length).toBeGreaterThan(
      4
    );
    expect(DEMO_RECIPES.filter((recipe) => recipe.cookbook === "weekend").length).toBeGreaterThan(
      2
    );
  });

  it("includes a peanut dish and pine-nut pesto so Child C blocks fire", () => {
    const pesto = DEMO_RECIPES.find((recipe) => recipe.slug === "pesto-pasta");
    const kungPao = DEMO_RECIPES.find((recipe) => recipe.slug === "kung-pao-chicken");
    expect(pesto?.ingredients.some((item) => /pesto/i.test(item.rawText))).toBe(true);
    expect(kungPao?.ingredients.some((item) => /peanut/i.test(item.rawText))).toBe(true);
  });

  it("seeds a meal plan and a shopping list", () => {
    expect(DEMO_PLAN_DINNERS.length).toBeGreaterThanOrEqual(5);
    expect(DEMO_SHOPPING_ITEMS.length).toBeGreaterThanOrEqual(8);
    const slugs = new Set(DEMO_RECIPES.map((recipe) => recipe.slug));
    expect(DEMO_PLAN_DINNERS.every((entry) => slugs.has(entry.slug))).toBe(true);
  });
});
