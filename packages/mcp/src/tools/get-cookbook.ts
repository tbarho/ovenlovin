import { z } from "zod";
import type { AuthContext } from "../auth/index";
import { CookbookService, RecipeService } from "@ovenlovin/core";
import { createDbClient } from "@ovenlovin/db";

export const getCookbookSchema = z.object({
  id: z.string().uuid(),
});

export type GetCookbookInput = z.infer<typeof getCookbookSchema>;

async function handler(input: GetCookbookInput, context: AuthContext) {
  const db = createDbClient(process.env.DATABASE_URL!);
  const cookbook = await new CookbookService(db).getCookbook(input.id);
  if (!cookbook || cookbook.householdId !== context.householdId) {
    throw new Error(`Cookbook not found: ${input.id}`);
  }

  const recipes = await new RecipeService(db).listRecipes(context.householdId, {
    cookbookId: input.id,
    pagination: { limit: 100 },
  });

  return {
    id: cookbook.id,
    name: cookbook.name,
    slug: cookbook.slug,
    description: cookbook.description ?? undefined,
    recipes: recipes.items.map((item) => ({
      id: item.id,
      title: item.title,
      servings: item.servings ?? undefined,
      prepTimeMinutes: item.prepTimeMinutes ?? undefined,
      cookTimeMinutes: item.cookTimeMinutes ?? undefined,
      images: item.images,
    })),
  };
}

export const getCookbookTool = {
  name: "get_cookbook",
  description: "Get a cookbook and the recipes filed in it.",
  inputSchema: getCookbookSchema,
  handler,
} as const;
