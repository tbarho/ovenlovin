import { describe, expect, it } from "vitest";
import { testRecipe } from "@/test/fixtures";
import { filterRecipesByQuery, pickerBookNote } from "./cookbook-recipes";

describe("pickerBookNote", () => {
  it("names the other books a recipe already lives in", () => {
    expect(pickerBookNote(true, [])).toBe("Already in this book");
    expect(pickerBookNote(true, ["Weekend treats"])).toBe(
      "Already in this book · also Weekend treats"
    );
    expect(pickerBookNote(false, ["Weekend treats"])).toBe("In Weekend treats");
    expect(pickerBookNote(false, [])).toBeNull();
  });
});

describe("filterRecipesByQuery", () => {
  const recipes = [
    testRecipe({ id: "1", title: "Weeknight pesto pasta" }),
    testRecipe({ id: "2", title: "Kung pao chicken" }),
    testRecipe({ id: "3", title: "Pesto pizza" }),
  ];

  it("returns all recipes when the query is blank", () => {
    expect(filterRecipesByQuery(recipes, "  ")).toHaveLength(3);
  });

  it("filters by title without hiding already-known matches", () => {
    expect(filterRecipesByQuery(recipes, "pesto").map((recipe) => recipe.title)).toEqual([
      "Weeknight pesto pasta",
      "Pesto pizza",
    ]);
  });
});
