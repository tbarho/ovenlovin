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
  copyRemoteImages,
  fingerprintImageBlob,
  keepMainRecipeImages,
  persistRecipeImageUrl,
  RecipeService,
  type ImagePutInput,
} from "@ovenlovin/core";
import { mcpRecipeImages } from "../media";
import { AI_GATEWAY_MISSING_MESSAGE, isAiGatewayConfigured } from "@ovenlovin/core/onboarding";
import { createDbClient } from "@ovenlovin/db";
import { runPhotoImport } from "@ovenlovin/importers";

const imagePartSchema = z.object({
  url: z.string().optional().describe("Public image or Vercel Blob URL"),
  base64: z.string().optional().describe("Raw base64 or data URL"),
  mimeType: z.string().optional().describe("MIME type when sending raw base64"),
});

export const importRecipeFromImageSchema = z
  .object({
    imageUrl: z.string().optional().describe("Public image or Vercel Blob URL"),
    imageBase64: z.string().optional().describe("Raw base64 or data URL"),
    mimeType: z.string().optional().describe("MIME type when sending raw base64"),
    images: z
      .array(imagePartSchema)
      .optional()
      .describe("Extra pages of the same recipe; the first photo is the main image"),
    isHandwritten: z.boolean().optional(),
    skipReview: z.boolean().default(false),
    cookbookId: z.string().uuid().optional(),
  })
  .refine(
    (value) =>
      Boolean(
        value.imageUrl?.trim() ||
        value.imageBase64?.trim() ||
        (value.images && value.images.length > 0)
      ),
    { message: "Provide imageUrl, imageBase64, or images[]" }
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

  const images = collectImages(input);
  const first = images[0]?.blob;
  if (!first) {
    throw new McpInvalidParamsError("Provide imageUrl, imageBase64, or images[]");
  }

  const db = createDbClient(process.env.DATABASE_URL!);
  const recipeService = new RecipeService(db);
  const fingerprint = fingerprintImageBlob(first);
  const duplicate = await recipeService.findPhotoImportDuplicate(context.householdId, fingerprint);
  if (duplicate) {
    throw new McpInvalidParamsError(
      `This photo was already imported as "${duplicate.title}" (${duplicate.id}). Skip or open that recipe.`
    );
  }

  const extracted = await runPhotoImport({ images, isHandwritten: input.isHandwritten }, {});
  const draft = extracted.draft;
  draft.images = await persistMainPhoto(first, context.householdId);
  draft.source = {
    ...draft.source,
    rawExtractionJson: {
      ...(draft.source.rawExtractionJson ?? {}),
      photoFingerprint: fingerprint,
    },
  };
  if (input.skipReview) {
    draft.needsReview = false;
  } else if (extracted.uncertainFields.length > 0) {
    draft.needsReview = true;
  }

  const recipe = await recipeService.createRecipeFromDraft(draft, {
    householdId: context.householdId,
    createdBy: context.userId ?? context.apiKeyId ?? context.householdId,
  });

  if (input.cookbookId) {
    const { CookbookService } = await import("@ovenlovin/core");
    const cookbooks = new CookbookService(db);
    const cookbook = await cookbooks.getCookbook(input.cookbookId);
    if (cookbook && cookbook.householdId === context.householdId) {
      await cookbooks.addRecipe(input.cookbookId, recipe.id);
    }
  }

  return {
    recipeId: recipe.id,
    status: recipe.status,
    title: recipe.title,
    notes: recipe.notes ?? null,
    servings: recipe.servings ?? undefined,
    prepTimeMinutes: recipe.prepTimeMinutes ?? undefined,
    cookTimeMinutes: recipe.cookTimeMinutes ?? undefined,
    images: mcpRecipeImages(recipe.id, recipe.images),
    confidence: draft.overallConfidence,
    uncertainFields: extracted.uncertainFields,
    allergenClassifications: extracted.allergenClassifications,
    lowConfidenceFields: draft.needsReview ? extracted.uncertainFields : undefined,
    message:
      draft.needsReview || extracted.uncertainFields.length > 0
        ? `Recipe imported from photo but needs review. Uncertain: ${
            extracted.uncertainFields.join(", ") || "see reviewReasons"
          }`
        : "Recipe imported from photo",
  };
}

export const importRecipeFromImageTool = {
  name: "import_recipe_from_image",
  description:
    "Import a recipe from a photo (URL or base64). Uses AI Gateway vision. The first image is stored as the single main photo. Returns uncertainFields when the photo is hard to read.",
  inputSchema: importRecipeFromImageSchema,
  handler,
} as const;
