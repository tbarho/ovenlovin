/**
 * Tool: import_recipe
 *
 * Import a recipe from URL, paste, or file
 */

import { z } from "zod";
import type { AuthContext } from "../auth/index";
import { RecipeService, type RecipeMethodTag } from "@ovenlovin/core";
import { createDbClient } from "@ovenlovin/db";
import { createUrlImporter, createPasteImporter } from "@ovenlovin/importers";

export const importRecipeSchema = z.object({
  source: z.enum(["url", "paste"]),
  content: z.string().describe("URL or pasted recipe text"),
  skipReview: z.boolean().default(false).describe("Skip review queue and publish immediately"),
});

export type ImportRecipeInput = z.infer<typeof importRecipeSchema>;

export interface ImportRecipeOutput {
  recipeId: string;
  status: "draft" | "needs_review" | "published";
  confidence: number;
  lowConfidenceFields?: string[];
  message: string;
}

async function handler(
  input: ImportRecipeInput,
  context: AuthContext
): Promise<ImportRecipeOutput> {
  const db = createDbClient(process.env.DATABASE_URL!);
  const recipeService = new RecipeService(db);

  let draft;
  if (input.source === "url") {
    const importer = createUrlImporter();
    const raw = await importer.extract({ url: input.content });
    draft = await importer.toDraft(raw);
  } else {
    const importer = createPasteImporter();
    const raw = await importer.extract({ text: input.content });
    draft = await importer.toDraft(raw);
  }

  // Generate slug from title
  const slug = draft.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  // Create recipe
  const recipe = await recipeService.createRecipe({
    householdId: context.householdId,
    title: draft.title,
    slug,
    description: draft.description ?? null,
    yieldQuantity: draft.yieldQuantity ?? null,
    yieldUnit: draft.yieldUnit ?? null,
    servings: draft.servings ?? null,
    prepTimeMinutes: draft.prepTimeMinutes ?? null,
    cookTimeMinutes: draft.cookTimeMinutes ?? null,
    totalTimeMinutes: draft.totalTimeMinutes ?? null,
    activeTimeMinutes: draft.activeTimeMinutes ?? null,
    methodTags: (draft.methodTags ?? []) as RecipeMethodTag[],
    cuisine: draft.cuisine ?? null,
    course: draft.course ?? null,
    difficulty: draft.difficulty ?? null,
    equipment: draft.equipment ?? [],
    images: draft.images ?? [],
    status: input.skipReview || !draft.needsReview ? "published" : "needs_review",
    visibility: "private",
    version: 1,
    isFamilyRecipe: false,
    createdBy: context.userId as string,
  });

  // TODO: Create ingredients and steps (need to add those methods to RecipeService)
  // For now, just return the recipe ID

  return {
    recipeId: recipe.id,
    status: recipe.status,
    confidence: draft.overallConfidence,
    lowConfidenceFields: draft.needsReview ? draft.reviewReasons : undefined,
    message: draft.needsReview
      ? `Recipe imported but needs review (confidence: ${Math.round(draft.overallConfidence * 100)}%)`
      : `Recipe imported successfully`,
  };
}

export const importRecipeTool = {
  name: "import_recipe",
  description:
    "Import a recipe from a URL or pasted text. Returns a draft recipe that may need review if confidence is low.",
  inputSchema: importRecipeSchema,
  handler,
} as const;
