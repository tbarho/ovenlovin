/**
 * @vitest-environment jsdom
 */
import { beforeEach, describe, expect, it } from "vitest";
import {
  readRecipeDeleteToast,
  recipeDeleteConfirmCopy,
  writeRecipeDeleteToast,
} from "./recipe-delete";

describe("recipeDeleteConfirmCopy", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
  });

  it("warns when the recipe is on a plan", () => {
    const copy = recipeDeleteConfirmCopy("Weeknight pesto pasta", ["2026-10-12", "2026-10-16"]);
    expect(copy.title).toBe("Delete Weeknight pesto pasta?");
    expect(copy.body).toContain("Monday, Oct 12");
    expect(copy.body).toContain("Friday, Oct 16");
  });

  it("still confirms when the recipe is not planned", () => {
    const copy = recipeDeleteConfirmCopy("Test Recipe 1", []);
    expect(copy.body).toContain("removes the recipe");
    expect(copy.body).not.toContain("on the plan");
  });

  it("stores an undo payload for the recipe list", () => {
    writeRecipeDeleteToast({ id: "r1", title: "Weeknight pesto pasta" });
    expect(readRecipeDeleteToast()).toEqual({ id: "r1", title: "Weeknight pesto pasta" });
    expect(readRecipeDeleteToast()).toBeNull();
  });
});
