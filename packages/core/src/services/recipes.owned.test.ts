import { describe, expect, it } from "vitest";
import { HouseholdAccessError } from "./kitchen-access";
import { RecipeService } from "./recipes";

function dbReturning(ids: string[]) {
  return {
    select: () => ({
      from: () => ({
        where: async () => ids.map((id) => ({ id })),
      }),
    }),
  };
}

describe("RecipeService.requireOwnedRecipeIds", () => {
  it("rejects a recipe that is not in this kitchen", async () => {
    const service = new RecipeService(dbReturning([]) as never);
    await expect(
      service.requireOwnedRecipeIds("kitchen-b", ["550e8400-e29b-41d4-a716-446655440000"])
    ).rejects.toBeInstanceOf(HouseholdAccessError);
  });

  it("allows recipes that are all in this kitchen", async () => {
    const id = "550e8400-e29b-41d4-a716-446655440000";
    const service = new RecipeService(dbReturning([id]) as never);
    await expect(
      service.requireOwnedRecipeIds("kitchen-b", [id, id, null])
    ).resolves.toBeUndefined();
  });
});
