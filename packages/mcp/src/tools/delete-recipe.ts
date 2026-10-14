import { z } from "zod";
import type { AuthContext } from "../auth/index";
import { RecipeService } from "@ovenlovin/core";
import { createDbClient } from "@ovenlovin/db";

export const deleteRecipeSchema = z.object({
  id: z.string().uuid(),
});

async function handler(input: z.infer<typeof deleteRecipeSchema>, context: AuthContext) {
  const db = createDbClient(process.env.DATABASE_URL!);
  const recipes = new RecipeService(db);
  const existing = await recipes.getRecipe(input.id);
  if (!existing || existing.householdId !== context.householdId) {
    throw new Error(`Recipe not found: ${input.id}`);
  }
  const deleted = await recipes.deleteRecipe(input.id);
  return { id: input.id, deleted };
}

export const deleteRecipeTool = {
  name: "delete_recipe",
  description: "Soft-delete a recipe in this household. Does not delete cookbooks.",
  inputSchema: deleteRecipeSchema,
  handler,
} as const;
