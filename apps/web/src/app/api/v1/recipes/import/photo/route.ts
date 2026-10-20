import { NextRequest } from "next/server";
import { CookbookService, fingerprintImageBlob, RecipeService } from "@ovenlovin/core";
import { perceptualHashFromImageBlob } from "@ovenlovin/core/photo-hash";
import { AI_GATEWAY_MISSING_MESSAGE, isAiGatewayConfigured } from "@ovenlovin/core/onboarding";
import { getDatabase } from "@ovenlovin/db";
import { BadRequestError, ConflictError, handleApiError } from "@/lib/api/errors";
import { createdResponse, jsonResponse } from "@/lib/api/response";
import {
  getIdempotencyKey,
  getRequestContext,
  requireWritableHousehold,
  requireUserId,
} from "@/lib/api/middleware";
import { createVercelImagePut } from "@/lib/blob-store";
import { readPhotoImportRequest } from "@/lib/photo-import-request";
import {
  classifyPhotoImportPreview,
  draftFromPhotoPreview,
  extractPhotoPreview,
  presentPhotoImportPreview,
} from "@/lib/photo-import";
import {
  conflictFromImportResult,
  importDuplicateDetail,
  isIdempotentReplay,
  nearPhotoDuplicateConflict,
  possibleDuplicateOf,
  recipeFromPersist,
  saveImportedRecipe,
  withDemoImportQuota,
} from "@/lib/import-save";
import { presentRecipeDetailsForApi, requestApiOrigin } from "@/lib/recipe-media";

export const runtime = "nodejs";
export const maxDuration = 60;

async function rejectExistingPhoto(householdId: string, blob: string | undefined): Promise<void> {
  if (!blob) return;
  const service = new RecipeService(getDatabase());
  const fingerprint = fingerprintImageBlob(blob);
  const exact = await service.findPhotoImportDuplicate(householdId, fingerprint);
  if (exact) {
    throw new ConflictError(importDuplicateDetail("photo", exact.title), {
      code: "import_duplicate",
      match: "photo",
      recipeId: exact.id,
      title: exact.title,
      recipeUrl: `/recipes/${exact.id}`,
    });
  }
}

export async function POST(request: NextRequest) {
  try {
    const context = await getRequestContext(request);
    const householdId = requireWritableHousehold(context);
    const createdBy = context.userId || context.clientId;
    if (!createdBy) {
      requireUserId(context);
    }

    if (!isAiGatewayConfigured(process.env)) {
      throw new BadRequestError(AI_GATEWAY_MISSING_MESSAGE);
    }

    const input = await readPhotoImportRequest(request);
    await rejectExistingPhoto(householdId, input.images[0]?.blob);

    const first = input.images[0]?.blob;
    const phash = first ? perceptualHashFromImageBlob(first) : null;
    const near = phash
      ? await new RecipeService(getDatabase()).findPhotoNearDuplicate(householdId, phash)
      : null;
    const possibleDuplicate = near ? possibleDuplicateOf(near) : undefined;
    if (near && input.save && !input.allowDuplicate) {
      throw nearPhotoDuplicateConflict(near);
    }

    const preview = await extractPhotoPreview(input.images, {
      householdId,
      isHandwritten: input.isHandwritten,
      put: createVercelImagePut(),
      abortSignal: request.signal,
    });
    const failure = classifyPhotoImportPreview(preview);
    if (failure === "blurry") {
      throw new BadRequestError(
        "This photo is too blurry to read. Try a sharper shot, or type or paste it.",
        { code: "PHOTO_BLURRY" }
      );
    }
    if (failure === "not_recipe") {
      throw new BadRequestError("That does not look like a recipe. Type or paste it instead.", {
        code: "PHOTO_NOT_RECIPE",
      });
    }

    if (!input.save) {
      return jsonResponse({
        ...presentPhotoImportPreview(preview),
        saved: false,
        preview: true,
        possibleDuplicate,
      });
    }

    const { result, quota } = await saveImportedRecipe(draftFromPhotoPreview(preview), {
      householdId,
      createdBy: createdBy as string,
      idempotencyKey: getIdempotencyKey(request),
    });
    if (result.outcome === "in_flight") {
      throw conflictFromImportResult(result);
    }
    const recipe = recipeFromPersist(result);

    if (input.cookbookId && result.outcome === "created") {
      const cookbooks = new CookbookService(getDatabase());
      const cookbook = await cookbooks.getCookbook(input.cookbookId);
      if (cookbook && cookbook.householdId === householdId) {
        await cookbooks.addRecipe(input.cookbookId, recipe.id);
      }
    }

    const presented = presentRecipeDetailsForApi(recipe, requestApiOrigin(request));
    const body = withDemoImportQuota(
      {
        ...presentPhotoImportPreview(preview),
        images: presented.images,
        recipe: presented,
        reviewReasons: presented.reviewReasons,
        uncertainFields: presented.uncertainFields,
      },
      quota
    );
    if (isIdempotentReplay(result)) {
      return jsonResponse(body);
    }
    return createdResponse(body, `/api/v1/recipes/${recipe.id}`);
  } catch (error) {
    return handleApiError(error, request.url);
  }
}
