import { z } from "zod";
import type { AuthContext } from "../auth/index";
import { CookbookService, RecipeService } from "@ovenlovin/core";
import { createDbClient } from "@ovenlovin/db";

export const createRecipeSchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().optional(),
  notes: z.string().optional(),
  servings: z.number().int().positive().optional(),
  prepTimeMinutes: z.number().int().nonnegative().optional(),
  cookTimeMinutes: z.number().int().nonnegative().optional(),
  totalTimeMinutes: z.number().int().nonnegative().optional(),
  cuisine: z.string().optional(),
  course: z.string().optional(),
  images: z.array(z.string()).optional(),
  ingredients: z
    .array(z.object({ rawText: z.string().min(1) }))
    .optional()
    .describe("Ingredient lines as written"),
  steps: z
    .array(z.object({ text: z.string().min(1) }))
    .optional()
    .describe("Instruction steps in order"),
  cookbookId: z.string().uuid().optional(),
  sourceUrl: z.string().optional(),
  status: z.enum(["draft", "needs_review", "published"]).optional(),
});

async function handler(input: z.infer<typeof createRecipeSchema>, context: AuthContext) {
  const db = createDbClient(process.env.DATABASE_URL!);
  const recipes = new RecipeService(db);
  const createdBy = context.userId ?? context.apiKeyId ?? context.householdId;

  const details = await recipes.createRecipeFromDraft(
    {
      title: input.title,
      description: input.description,
      notes: input.notes,
      servings: input.servings,
      prepTimeMinutes: input.prepTimeMinutes,
      cookTimeMinutes: input.cookTimeMinutes,
      totalTimeMinutes: input.totalTimeMinutes,
      cuisine: input.cuisine,
      course: input.course,
      images: input.images ?? [],
      ingredients: (input.ingredients ?? []).map((item) => ({ rawText: item.rawText })),
      steps: (input.steps ?? []).map((item) => ({ text: item.text })),
      source: {
        type: input.sourceUrl ? "url" : "manual",
        url: input.sourceUrl,
        importerName: "mcp-create-recipe",
        importerVersion: "1",
        rawExtractionJson: { via: "create_recipe" },
      },
      needsReview: input.status === "needs_review" || input.status === "draft",
    },
    { householdId: context.householdId, createdBy }
  );

  if (input.status === "draft" && details.status !== "draft") {
    await recipes.updateRecipe(details.id, { status: "draft" });
  }
  if (input.status === "published" && details.status !== "published") {
    await recipes.updateRecipe(details.id, { status: "published" });
  }

  if (input.cookbookId) {
    const cookbooks = new CookbookService(db);
    const cookbook = await cookbooks.getCookbook(input.cookbookId);
    if (cookbook && cookbook.householdId === context.householdId) {
      await cookbooks.addRecipe(input.cookbookId, details.id);
    }
  }

  return {
    recipeId: details.id,
    title: details.title,
    status: details.status,
    servings: details.servings ?? undefined,
    images: details.images,
    ingredientCount: details.ingredients.length,
    stepCount: details.steps.length,
  };
}

export const createRecipeTool = {
  name: "create_recipe",
  description:
    "Create a recipe directly from title, ingredients, and steps (no URL import). Prefer import_recipe when a public URL exists.",
  inputSchema: createRecipeSchema,
  handler,
} as const;
