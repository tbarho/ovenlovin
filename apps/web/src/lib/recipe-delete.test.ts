import { describe, expect, it } from "vitest";
import { recipeDeleteConfirmCopy } from "./recipe-delete";

describe("recipeDeleteConfirmCopy", () => {
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
});
