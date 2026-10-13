import { z } from "zod";
import type { AuthContext } from "../auth/index";
import { CookbookService } from "@ovenlovin/core";
import { createDbClient } from "@ovenlovin/db";

export const listCookbooksSchema = z.object({
  includeEmpty: z.boolean().default(true),
});

export type ListCookbooksInput = z.infer<typeof listCookbooksSchema>;

async function handler(input: ListCookbooksInput, context: AuthContext) {
  const db = createDbClient(process.env.DATABASE_URL!);
  const cards = await new CookbookService(db).listCookbookCards(context.householdId);
  return {
    cookbooks: (input.includeEmpty ? cards : cards.filter((card) => card.recipeCount > 0)).map(
      (card) => ({
        id: card.id,
        name: card.name,
        slug: card.slug,
        description: card.description ?? undefined,
        recipeCount: card.recipeCount,
        previewImages: card.previewImages,
      })
    ),
  };
}

export const listCookbooksTool = {
  name: "list_cookbooks",
  description: "List household cookbooks with recipe counts and preview images.",
  inputSchema: listCookbooksSchema,
  handler,
} as const;
