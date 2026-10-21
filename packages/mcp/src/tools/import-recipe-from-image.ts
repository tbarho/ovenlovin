/**
 * Tool: import_recipe_from_image
 *
 * Import a recipe from a photo URL or base64 image via AI Gateway vision.
 */

import { z } from "zod";
import type { AuthContext } from "../auth/index";
import { requireWriteRole } from "../auth/index";
import { McpInvalidParamsError } from "../json-rpc";
import {
  assertAllowedRecipeImageUrls,
  copyRemoteImages,
  draftFromSavedPreview,
  fingerprintImageBlob,
  isAllowedRecipeImageUrl,
  INVALID_IMAGE_URL_MESSAGE,
  keepMainRecipeImages,
  persistRecipeImageUrl,
  presentPhotoImportImages,
  RecipeService,
  type ImagePutInput,
} from "@ovenlovin/core";
import { perceptualHashFromImageBlob } from "@ovenlovin/core/photo-hash";
import { mcpRecipeImages } from "../media";
import { AI_GATEWAY_MISSING_MESSAGE, isAiGatewayConfigured } from "@ovenlovin/core/onboarding";
import { createDbClient } from "@ovenlovin/db";
import { runPhotoImport } from "@ovenlovin/importers";

const imagePartSchema = z.object({
  url: z
    .string()
    .refine((url) => !url.trim() || isAllowedRecipeImageUrl(url), {
      message: INVALID_IMAGE_URL_MESSAGE,
    })
    .optional()
    .describe("Public image or Vercel Blob URL"),
  base64: z.string().optional().describe("Raw base64 or data URL"),
  mimeType: z.string().optional().describe("MIME type when sending raw base64"),
});

export const importRecipeFromImageSchema = z
  .object({
    imageUrl: z
      .string()
      .refine((url) => !url.trim() || isAllowedRecipeImageUrl(url), {
        message: INVALID_IMAGE_URL_MESSAGE,
      })
      .optional()
      .describe("Public image or Vercel Blob URL"),
    imageBase64: z.string().optional().describe("Raw base64 or data URL"),
    mimeType: z.string().optional().describe("MIME type when sending raw base64"),
    images: z
      .array(imagePartSchema)
      .optional()
      .describe("Extra pages of the same recipe; the first photo is the main image"),
    isHandwritten: z.boolean().optional(),
    draft: z.unknown().optional().describe("Previewed recipe from a prior import. Skips extract."),
    save: z
      .boolean()
      .optional()
      .describe("false returns a preview without saving; omit to persist"),
    idempotencyKey: z.string().optional().describe("Same key replays the same saved recipe"),
    allowDuplicate: z
      .boolean()
      .optional()
      .describe("Persist a near-duplicate photo instead of returning the existing recipe"),
    skipReview: z.boolean().default(false).describe("Skip review queue and publish immediately"),
    cookbookId: z.string().uuid().optional(),
  })
  .refine(
    (value) =>
      Boolean(
        value.imageUrl?.trim() ||
        value.imageBase64?.trim() ||
        (value.images && value.images.length > 0) ||
        value.draft != null
      ),
    { message: "Provide imageUrl, imageBase64, images[], or draft" }
  );

export type ImportRecipeFromImageInput = z.infer<typeof importRecipeFromImageSchema>;

function asDataUrl(value: string, mimeType = "image/jpeg"): string {
  const trimmed = value.trim();
  if (trimmed.startsWith("data:")) return trimmed;
  return `data:${mimeType};base64,${trimmed.replace(/\s+/g, "")}`;
}

function collectImages(input: ImportRecipeFromImageInput): Array<{ blob: string }> {
  const images: Array<{ blob: string }> = [];
  if (input.imageUrl?.trim()) images.push({ blob: input.imageUrl.trim() });
  if (input.imageBase64?.trim()) {
    images.push({ blob: asDataUrl(input.imageBase64, input.mimeType) });
  }
  for (const part of input.images ?? []) {
    if (part.url?.trim()) images.push({ blob: part.url.trim() });
    else if (part.base64?.trim()) images.push({ blob: asDataUrl(part.base64, part.mimeType) });
  }
  return images;
}

async function persistMainPhoto(blob: string, householdId: string): Promise<string[]> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return keepMainRecipeImages([blob]);
  }
  const { put } = await import("@vercel/blob");
  const putStored = async ({ pathname, body, contentType }: ImagePutInput) => {
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
  };

  if (blob.startsWith("data:")) {
    const stored = await persistRecipeImageUrl(
      blob,
      putStored,
      `recipes/${householdId}/photo-import/1`
    );
    return keepMainRecipeImages([stored]);
  }

  return copyRemoteImages(keepMainRecipeImages([blob]), putStored, `recipes/${householdId}`);
}

async function handler(input: ImportRecipeFromImageInput, context: AuthContext) {
  requireWriteRole(context);
  if (!isAiGatewayConfigured(process.env)) {
    throw new Error(AI_GATEWAY_MISSING_MESSAGE);
  }

  const savedDraft = input.draft != null ? draftFromSavedPreview(input.draft) : null;
  if (input.draft != null && !savedDraft) {
    throw new McpInvalidParamsError("That previewed draft is not a recipe");
  }

  const images = collectImages(input);
  assertAllowedRecipeImageUrls(images.map((image) => image.blob));
  const first = images[0]?.blob;
  if (!first && !savedDraft) {
    throw new McpInvalidParamsError("Provide imageUrl, imageBase64, or images[]");
  }

  const db = createDbClient(process.env.DATABASE_URL!);
  const recipeService = new RecipeService(db);
  const fingerprint = first ? fingerprintImageBlob(first) : null;
  const perceptualHash = first ? perceptualHashFromImageBlob(first) : null;
  if (fingerprint) {
    const exact = await recipeService.findPhotoImportDuplicate(context.householdId, fingerprint);
    if (exact && !input.allowDuplicate) {
      return {
        recipeId: exact.id,
        created: false,
        duplicate: true,
        status: exact.status,
        title: exact.title,
        notes: exact.notes ?? null,
        servings: exact.servings ?? undefined,
        images: mcpRecipeImages(exact.id, exact.images),
        confidence: 1,
        message: `This photo was already imported as "${exact.title}" (${exact.id}). Open that recipe instead of importing again.`,
      };
    }
  }

  const near =
    perceptualHash && input.save !== false && !input.allowDuplicate
      ? await recipeService.findPhotoNearDuplicate(context.householdId, perceptualHash)
      : null;
  if (near) {
    return {
      recipeId: near.id,
      created: false,
      duplicate: true,
      possibleDuplicate: { recipeId: near.id, title: near.title },
      status: near.status,
      title: near.title,
      notes: near.notes ?? null,
      servings: near.servings ?? undefined,
      images: mcpRecipeImages(near.id, near.images),
      confidence: 1,
      message: `A similar photo was already imported as "${near.title}" (${near.id}). Send allowDuplicate:true to save this recipe anyway.`,
    };
  }

  let draft = savedDraft;
  let extracted: Awaited<ReturnType<typeof runPhotoImport>> | null = null;
  if (!draft) {
    extracted = await runPhotoImport({ images, isHandwritten: input.isHandwritten }, {});
    draft = extracted.draft;
  }
  if (first) {
    draft.images = await persistMainPhoto(first, context.householdId);
    draft.source = {
      ...draft.source,
      rawExtractionJson: {
        ...(draft.source.rawExtractionJson ?? {}),
        photoFingerprint: fingerprint,
        photoPerceptualHash: perceptualHash ?? undefined,
      },
    };
  }
  if (input.skipReview) {
    draft.needsReview = false;
  } else if (extracted && extracted.uncertainFields.length > 0) {
    draft.needsReview = true;
  }
  if (extracted) {
    draft.reviewReasons = extracted.draft.reviewReasons;
    draft.uncertainFields = extracted.uncertainFields;
  }

  if (input.save === false) {
    const nearPreview = perceptualHash
      ? await recipeService.findPhotoNearDuplicate(context.householdId, perceptualHash)
      : null;
    return {
      saved: false,
      preview: true,
      title: draft.title,
      notes: draft.notes ?? null,
      servings: draft.servings,
      prepTimeMinutes: draft.prepTimeMinutes,
      cookTimeMinutes: draft.cookTimeMinutes,
      images: presentPhotoImportImages(draft.images),
      ingredients: draft.ingredients,
      steps: draft.steps,
      draft,
      confidence: extracted?.draft.overallConfidence ?? 1,
      reviewReasons: draft.reviewReasons,
      uncertainFields: extracted?.uncertainFields ?? draft.uncertainFields,
      possibleDuplicate: nearPreview
        ? { recipeId: nearPreview.id, title: nearPreview.title }
        : undefined,
      message: "Preview only. Send save:true with this draft to persist.",
    };
  }

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
    images: mcpRecipeImages(recipe.id, recipe.images),
    confidence: extracted?.draft.overallConfidence ?? 1,
    reviewReasons: recipe.reviewReasons,
    uncertainFields:
      recipe.uncertainFields.length > 0
        ? recipe.uncertainFields
        : (extracted?.uncertainFields ?? draft.uncertainFields ?? []),
    allergenClassifications: extracted?.allergenClassifications ?? [],
    lowConfidenceFields: draft.needsReview
      ? (extracted?.uncertainFields ?? draft.uncertainFields)
      : undefined,
    message: !created
      ? `This photo was already imported as "${recipe.title}" (${recipe.id}). Open that recipe instead of importing again.`
      : draft.needsReview || (extracted?.uncertainFields.length ?? 0) > 0
        ? `Recipe imported from photo but needs review. Uncertain: ${
            (extracted?.uncertainFields ?? draft.uncertainFields ?? []).join(", ") ||
            "see reviewReasons"
          }`
        : "Recipe imported from photo",
  };
}

export const importRecipeFromImageTool = {
  name: "import_recipe_from_image",
  description:
    "Import a recipe from a photo (URL or base64). Uses AI Gateway vision. The first image is stored as the single main photo. save:false returns a preview; omit save to persist. skipReview clears needsReview. Returns uncertainFields when the photo is hard to read.",
  inputSchema: importRecipeFromImageSchema,
  handler,
} as const;
