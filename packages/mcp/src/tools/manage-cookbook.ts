import { z } from "zod";
import type { AuthContext } from "../auth/index";
import { requireWriteRole } from "../auth/index";
import { CookbookService, RecipeService } from "@ovenlovin/core";
import { createDbClient } from "@ovenlovin/db";

export const manageCookbookSchema = z.object({
  action: z.enum(["create", "rename", "delete", "add_recipe", "remove_recipe"]),
  id: z.string().uuid().optional(),
  name: z.string().min(1).max(255).optional(),
  description: z.string().optional(),
  recipeId: z.string().uuid().optional(),
});

export type ManageCookbookInput = z.infer<typeof manageCookbookSchema>;

async function handler(input: ManageCookbookInput, context: AuthContext) {
  requireWriteRole(context);
  const db = createDbClient(process.env.DATABASE_URL!);
  const cookbooks = new CookbookService(db);

  if (input.action === "create") {
    if (!input.name) throw new Error("name is required to create a cookbook");
    const created = await cookbooks.createCookbook({
      householdId: context.householdId,
      name: input.name,
      description: input.description ?? null,
      createdBy: context.userId ?? context.apiKeyId ?? context.householdId,
    });
    return { id: created.id, name: created.name, status: "created" as const };
  }

  if (!input.id) throw new Error("id is required");
  const cookbook = await cookbooks.getCookbook(input.id);
  if (!cookbook || cookbook.householdId !== context.householdId) {
    throw new Error(`Cookbook not found: ${input.id}`);
  }

  if (input.action === "rename") {
    if (!input.name) throw new Error("name is required to rename a cookbook");
    const updated = await cookbooks.updateCookbook(input.id, {
      name: input.name,
      description: input.description,
    });
    return { id: input.id, name: updated?.name, status: "renamed" as const };
  }

  if (input.action === "delete") {
    await cookbooks.deleteCookbook(input.id);
    return { id: input.id, status: "deleted" as const };
  }

  if (!input.recipeId) throw new Error("recipeId is required");
  const recipe = await new RecipeService(db).getRecipe(input.recipeId);
  if (!recipe || recipe.householdId !== context.householdId) {
    throw new Error(`Recipe not found: ${input.recipeId}`);
  }

  if (input.action === "add_recipe") {
    await cookbooks.addRecipe(input.id, input.recipeId);
    return { id: input.id, recipeId: input.recipeId, status: "added" as const };
  }

  await cookbooks.removeRecipe(input.id, input.recipeId);
  return { id: input.id, recipeId: input.recipeId, status: "removed" as const };
}

export const manageCookbookTool = {
  name: "manage_cookbook",
  description:
    "Create, rename, or delete a cookbook, or add/remove a recipe. Cookbooks are many-to-many folders for recipes.",
  inputSchema: manageCookbookSchema,
  handler,
} as const;
