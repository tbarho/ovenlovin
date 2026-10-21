import { describe, expect, it } from "vitest";
import { NotFoundError } from "./errors";
import { assertRecipeHousehold } from "./recipes";

describe("assertRecipeHousehold", () => {
  it("404s when the recipe is in another kitchen", () => {
    expect(() =>
      assertRecipeHousehold({ householdId: "kitchen-a" } as never, "kitchen-b", "recipe-1")
    ).toThrow(NotFoundError);
    expect(() => assertRecipeHousehold(null, "kitchen-b", "recipe-1")).toThrow(NotFoundError);
  });

  it("allows a recipe in the caller's kitchen", () => {
    expect(() =>
      assertRecipeHousehold({ householdId: "kitchen-a" } as never, "kitchen-a")
    ).not.toThrow();
  });
});
