/**
 * Tool: import_recipe
 *
 * Import a recipe from URL or pasted text
 */

import { z } from "zod";
import type { AuthContext } from "../auth/index";
import { requireWriteRole } from "../auth/index";
import {
  copyRemoteImages,
  draftFromPlainText,
  keepMainRecipeImages,
  prepareImportDraft,
  RecipeService,
} from "@ovenlovin/core";
import { isAiGatewayConfigured } from "@ovenlovin/core/onboarding";
import { createDbClient } from "@ovenlovin/db";
import { createUrlImporter, createPasteImporter } from "@ovenlovin/importers";

export const importRecipeSchema = z.object({
  source: z.enum(["url", "paste"]),
  content: z.string().describe("URL or pasted recipe text"),
  skipReview: z.boolean().default(false).describe("Skip review queue and publish immediately"),
  cookbookId: z.string().uuid().optional().describe("Optional cookbook to file the recipe in"),
});

export type ImportRecipeInput = z.infer<typeof importRecipeSchema>;

export interface ImportRecipeOutput {
  recipeId: string;
  created?: boolean;
  duplicate?: boolean;
  status: "draft" | "needs_review" | "published";
  title: string;
  notes: string | null;
  servings?: number;
  prepTimeMinutes?: number;
  cookTimeMinutes?: number;
  images: string[];
  confidence: number;
  lowConfidenceFields?: string[];
  reviewReasons?: string[];
  uncertainFields?: string[];
  message: string;
}

async function persistImages(urls: string[], householdId: string): Promise<string[]> {
  if (!process.env.BLOB_READ_WRITE_TOKEN || urls.length === 0) return urls;
  const { put } = await import("@vercel/blob");
  return copyRemoteImages(
    urls,
    async ({ pathname, body, contentType }) => {
      try {
        const stored = await put(pathname, body, {
          access: "public",
          contentType,
          addRandomSuffix: true,
        });
        return stored.url;
      } catch {
        return null;
      }
    },
    `recipes/${householdId}`
  );
}

async function handler(
  input: ImportRecipeInput,
  context: AuthContext
): Promise<ImportRecipeOutput> {
  requireWriteRole(context);
  const db = createDbClient(process.env.DATABASE_URL!);
  const recipeService = new RecipeService(db);

  let draft;
  if (input.source === "url") {
    const importer = createUrlImporter();
    const raw = await importer.extract({ url: input.content });
    draft = await importer.toDraft(raw);
  } else if (isAiGatewayConfigured(process.env)) {
    const importer = createPasteImporter();
    const raw = await importer.extract({ text: input.content });
    draft = await importer.toDraft(raw);
  } else {
    draft = draftFromPlainText(input.content);
  }

  if (input.skipReview) {
    draft.needsReview = false;
  }

  draft = prepareImportDraft(draft);
  const existing = await recipeService.findImportDuplicate(context.householdId, draft);
  if (existing) {
    const recipe = existing.recipe;
    return {
      recipeId: recipe.id,
      created: false,
      duplicate: true,
      status: recipe.status,
      title: recipe.title,
      notes: recipe.notes ?? null,
      servings: recipe.servings ?? undefined,
      prepTimeMinutes: recipe.prepTimeMinutes ?? undefined,
      cookTimeMinutes: recipe.cookTimeMinutes ?? undefined,
      images: recipe.images,
      confidence: 1,
      reviewReasons: recipe.reviewReasons,
      uncertainFields: recipe.uncertainFields,
      message: `This recipe was already imported as "${recipe.title}" (${recipe.id}). Open that recipe instead of importing again.`,
    };
  }

  draft.images = await persistImages(keepMainRecipeImages(draft.images), context.householdId);

  const persisted = await recipeService.persistImportedDraft(draft, {
    householdId: context.householdId,
    createdBy: context.userId ?? context.apiKeyId ?? context.householdId,
  });
  if (persisted.outcome === "in_flight") {
    throw new Error("This import is already in progress. Retry the same request.");
  }
  const recipe = persisted.recipe;
  const created = persisted.outcome === "created";

  if (input.cookbookId && created) {
    const { CookbookService } = await import("@ovenlovin/core");
    const cookbooks = new CookbookService(db);
    const cookbook = await cookbooks.getCookbook(input.cookbookId);
    if (cookbook && cookbook.householdId === context.householdId) {
      await cookbooks.addRecipe(input.cookbookId, recipe.id);
    }
  }

  const scored = draft as {
    overallConfidence?: number;
    reviewReasons?: string[];
  };
  const confidence = typeof scored.overallConfidence === "number" ? scored.overallConfidence : 0.5;

  return {
    recipeId: recipe.id,
    created,
    duplicate: !created,
    status: recipe.status,
    title: recipe.title,
    notes: recipe.notes ?? null,
    servings: recipe.servings ?? undefined,
    prepTimeMinutes: recipe.prepTimeMinutes ?? undefined,
    cookTimeMinutes: recipe.cookTimeMinutes ?? undefined,
    images: recipe.images,
    confidence,
    lowConfidenceFields: draft.needsReview ? scored.reviewReasons : undefined,
    reviewReasons: recipe.reviewReasons,
    uncertainFields: recipe.uncertainFields,
    message: !created
      ? `This recipe was already imported as "${recipe.title}" (${recipe.id}). Open that recipe instead of importing again.`
      : draft.needsReview
        ? `Recipe imported but needs review (confidence: ${Math.round(confidence * 100)}%)`
        : `Recipe imported successfully`,
  };
}

export const importRecipeTool = {
  name: "import_recipe",
  description:
    "Import a recipe from a URL or pasted text. Pulls schema.org prep/cook times, servings, and the main image (copied into Vercel Blob).",
  inputSchema: importRecipeSchema,
  handler,
} as const;
