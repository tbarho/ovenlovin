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
  draftFromSavedPreview,
  keepMainRecipeImages,
  prepareImportDraft,
  RecipeService,
} from "@ovenlovin/core";
import { isAiGatewayConfigured } from "@ovenlovin/core/onboarding";
import { createDbClient } from "@ovenlovin/db";
import { createUrlImporter, createPasteImporter } from "@ovenlovin/importers";

export const importRecipeSchema = z.object({
  source: z.enum(["url", "paste"]),
  content: z.string().optional().describe("URL or pasted recipe text"),
  draft: z.unknown().optional().describe("Previewed recipe from a prior import. Skips extract."),
  save: z.boolean().optional().describe("false returns a preview without saving; omit to persist"),
  idempotencyKey: z.string().optional().describe("Same key replays the same saved recipe"),
  allowDuplicate: z
    .boolean()
    .optional()
    .describe("Persist even when this URL or draft already exists"),
  skipReview: z.boolean().default(false).describe("Skip review queue and publish immediately"),
  cookbookId: z.string().uuid().optional().describe("Optional cookbook to file the recipe in"),
});

export type ImportRecipeInput = z.infer<typeof importRecipeSchema>;

export interface ImportRecipeOutput {
  recipeId?: string;
  created?: boolean;
  duplicate?: boolean;
  saved?: boolean;
  preview?: boolean;
  status?: "draft" | "needs_review" | "published";
  title: string;
  notes: string | null;
  servings?: number;
  prepTimeMinutes?: number;
  cookTimeMinutes?: number;
  images: string[];
  ingredients?: unknown[];
  steps?: unknown[];
  draft?: unknown;
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

  let draft = input.draft != null ? draftFromSavedPreview(input.draft) : null;
  if (input.draft != null && !draft) {
    throw new Error("That previewed draft is not a recipe");
  }
  if (!draft) {
    if (!input.content?.trim()) {
      throw new Error("Provide content or draft");
    }
    if (input.source === "url") {
      const collision = await recipeService.findUrlImportCollision(
        context.householdId,
        input.content,
        input.idempotencyKey
      );
      if (collision && (collision.match === "idempotency" || !input.allowDuplicate)) {
        const recipe = collision.recipe;
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
  }

  if (input.skipReview) {
    draft.needsReview = false;
  }

  draft = prepareImportDraft(draft);
  if (input.save === false) {
    return {
      saved: false,
      preview: true,
      title: draft.title,
      notes: draft.notes ?? null,
      servings: draft.servings,
      prepTimeMinutes: draft.prepTimeMinutes,
      cookTimeMinutes: draft.cookTimeMinutes,
      images: draft.images ?? [],
      ingredients: draft.ingredients,
      steps: draft.steps,
      draft,
      confidence: 1,
      reviewReasons: draft.reviewReasons,
      uncertainFields: draft.uncertainFields,
      message: "Preview only. Send save:true with this draft to persist.",
    };
  }
  const existing = input.allowDuplicate
    ? null
    : await recipeService.findImportDuplicate(context.householdId, draft);
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
    idempotencyKey: input.idempotencyKey,
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
    "Import a recipe from a URL or pasted text. Pulls schema.org prep/cook times, servings, and the main image (copied into Vercel Blob). save:false returns a preview; omit save to persist. skipReview clears needsReview. idempotencyKey replays a save.",
  inputSchema: importRecipeSchema,
  handler,
} as const;
