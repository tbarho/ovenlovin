import { describe, expect, it } from "vitest";
import { E2E_PEOPLE, E2E_RECIPES } from "./e2e-kitchen";

describe("e2e kitchen fixture", () => {
  it("seeds the requested household members", () => {
    expect(E2E_PEOPLE.map((person) => person.displayName)).toEqual([
      "Ty",
      "Bec",
      "Ellie",
      "Laynie",
      "Jake",
    ]);
  });

  it("includes about eight recipes with images and two cookbooks", () => {
    expect(E2E_RECIPES.length).toBeGreaterThanOrEqual(8);
    expect(E2E_RECIPES.every((recipe) => recipe.images?.[0]?.startsWith("/e2e-kitchen/"))).toBe(
      true
    );
    expect(E2E_RECIPES.filter((recipe) => recipe.cookbook === "weeknight").length).toBeGreaterThan(
      1
    );
    expect(E2E_RECIPES.filter((recipe) => recipe.cookbook === "weekend").length).toBeGreaterThan(1);
  });

  it("includes a peanut dish and a pine-nut pesto so Jake's rules fire", () => {
    const pesto = E2E_RECIPES.find((recipe) => recipe.slug === "pesto-pasta");
    const kungPao = E2E_RECIPES.find((recipe) => recipe.slug === "kung-pao-chicken");
    expect(pesto?.ingredients.some((item) => /pesto/i.test(item.rawText))).toBe(true);
    expect(kungPao?.ingredients.some((item) => /peanut/i.test(item.rawText))).toBe(true);
  });
});
