import { describe, expect, it } from "vitest";
import {
  E2E_PEOPLE,
  E2E_RECIPES,
  E2E_TY_CANT_EAT,
  E2E_TY_DOESNT_LIKE,
  E2E_TY_LOVES,
  e2eKitchenWeekStart,
} from "./e2e-kitchen";

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

  it("seeds a dense person with 6+ items in every People card section", () => {
    expect(E2E_TY_CANT_EAT.length).toBeGreaterThanOrEqual(6);
    expect(E2E_TY_DOESNT_LIKE.length).toBeGreaterThanOrEqual(6);
    expect(E2E_TY_LOVES.length).toBeGreaterThanOrEqual(6);
    expect(E2E_TY_CANT_EAT.filter((item) => item.kind === "allergen").length).toBeGreaterThan(1);
    expect(E2E_TY_LOVES[0]).toBe("salmon");
  });

  it("places the draft plan on the current Monday week so This week has pesto", () => {
    expect(e2eKitchenWeekStart("2026-10-19")).toBe("2026-10-19");
    expect(e2eKitchenWeekStart("2026-10-18")).toBe("2026-10-12");
    expect(e2eKitchenWeekStart()).toBe(e2eKitchenWeekStart(new Date().toISOString().slice(0, 10)));
  });

  it("includes a peanut dish and a pine-nut pesto so Jake's rules fire", () => {
    const pesto = E2E_RECIPES.find((recipe) => recipe.slug === "pesto-pasta");
    const kungPao = E2E_RECIPES.find((recipe) => recipe.slug === "kung-pao-chicken");
    expect(pesto?.ingredients.some((item) => /pesto/i.test(item.rawText))).toBe(true);
    expect(kungPao?.ingredients.some((item) => /peanut/i.test(item.rawText))).toBe(true);
  });

  it("includes a 6-serving chili so a 5-person cook-for can disagree with yield", () => {
    const chili = E2E_RECIPES.find((recipe) => recipe.slug === "beef-chili");
    expect(chili?.servings).toBe(6);
    expect(chili?.ingredients.some((item) => item.rawText === "1 lb ground beef")).toBe(true);
    expect(chili?.ingredients.some((item) => item.rawText === "2 lemons")).toBe(true);
  });

  it("stores schema.org-style 2/3 decimals on tomato soup so display can format them", () => {
    const soup = E2E_RECIPES.find((recipe) => recipe.slug === "tomato-soup");
    expect(soup?.servings).toBe(5);
    expect(soup?.ingredients.some((item) => item.rawText === "0.6666666667 cup celery")).toBe(true);
    expect(soup?.ingredients.some((item) => item.rawText === "0.6666666667 cup carrot")).toBe(true);
  });
});
