import { describe, expect, it } from "vitest";
import { E2E_RECIPES } from "./e2e-kitchen";
import { E2E_FULL_EXTRA_RULES, E2E_FULL_PEOPLE, E2E_FULL_RECIPES } from "./e2e-kitchen-full";

describe("e2e kitchen full fixture", () => {
  it("adds about twenty recipes across the states the base seed lacks", () => {
    expect(E2E_FULL_RECIPES.length).toBeGreaterThanOrEqual(18);
    const slugs = E2E_FULL_RECIPES.map((recipe) => recipe.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    expect(E2E_FULL_RECIPES.filter((recipe) => recipe.needsReview).length).toBe(1);
    expect(E2E_FULL_RECIPES.filter((recipe) => recipe.after === "draft").length).toBe(1);
    expect(E2E_FULL_RECIPES.filter((recipe) => recipe.after === "delete").length).toBe(1);
    expect(E2E_FULL_RECIPES.filter((recipe) => recipe.source.type === "url").length).toBe(1);
    expect(E2E_FULL_RECIPES.filter((recipe) => recipe.source.type === "pdf").length).toBe(1);
    expect(
      E2E_FULL_RECIPES.some((recipe) => recipe.ingredients.some((i) => /coconut/i.test(i.rawText)))
    ).toBe(true);
    // Without E2E_KITCHEN_PHOTOS every full recipe is imageless (no local SVGs exist for them).
    expect(E2E_FULL_RECIPES.every((recipe) => recipe.images?.length === 0)).toBe(true);
  });

  it("never collides with base titles or the strings the kitchen e2e specs match on", () => {
    const base = new Set(E2E_RECIPES.map((recipe) => recipe.title.toLowerCase()));
    for (const recipe of E2E_FULL_RECIPES) {
      expect(base.has(recipe.title.toLowerCase())).toBe(false);
      expect(recipe.title).not.toMatch(/pesto pasta|tomato pasta|jake/i);
    }
    for (const person of E2E_FULL_PEOPLE) expect(person.displayName).not.toMatch(/jake|ty/i);
  });

  it("covers warn, diet, dated, and coconut-off rules", () => {
    const rules = [
      ...E2E_FULL_PEOPLE.flatMap((person) => person.rules),
      ...E2E_FULL_EXTRA_RULES.map((item) => item.rule),
    ];
    expect(rules.some((rule) => rule.severity === "warn")).toBe(true);
    expect(rules.some((rule) => rule.kind === "diet")).toBe(true);
    expect(rules.some((rule) => rule.activeFrom && rule.activeUntil)).toBe(true);
    expect(
      rules.some((rule) => rule.target === "tree_nut" && rule.treatCoconutAsTreeNut === false)
    ).toBe(true);
    expect(
      E2E_FULL_PEOPLE.some((person) => person.rules.length === 0 && person.loves.length === 0)
    ).toBe(true);
  });
});
