import { NextRequest } from "next/server";
import { CookbookService, fingerprintImageBlob, RecipeService } from "@ovenlovin/core";
import { AI_GATEWAY_MISSING_MESSAGE, isAiGatewayConfigured } from "@ovenlovin/core/onboarding";
import { getDatabase } from "@ovenlovin/db";
import { BadRequestError, ConflictError, handleApiError } from "@/lib/api/errors";
import { createdResponse, jsonResponse } from "@/lib/api/response";
import { getRequestContext, requireHouseholdId, requireUserId } from "@/lib/api/middleware";
import { createVercelImagePut } from "@/lib/blob-store";
import { recordSuccessfulDemoImport } from "@/lib/demo/enforce";
import { readPhotoImportRequest } from "@/lib/photo-import-request";
import {
  classifyPhotoImportPreview,
  draftFromPhotoPreview,
  extractPhotoPreview,
  presentPhotoImportPreview,
} from "@/lib/photo-import";
import { presentRecipeDetailsForApi, requestApiOrigin } from "@/lib/recipe-media";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const context = await getRequestContext(request);
    const householdId = requireHouseholdId(context);
    const createdBy = context.userId || context.clientId;
    if (!createdBy) {
      requireUserId(context);
    }

    if (!isAiGatewayConfigured(process.env)) {
      throw new BadRequestError(AI_GATEWAY_MISSING_MESSAGE);
    }

    const input = await readPhotoImportRequest(request);
    const first = input.images[0]?.blob;
    if (first) {
      const duplicate = await new RecipeService(getDatabase()).findPhotoImportDuplicate(
        householdId,
        fingerprintImageBlob(first)
      );
      if (duplicate) {
        throw new ConflictError("This photo was already imported as a recipe", {
          recipeId: duplicate.id,
          title: duplicate.title,
        });
      }
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
      return jsonResponse(presentPhotoImportPreview(preview));
    }

    const db = getDatabase();
    const service = new RecipeService(db);
    const recipe = await service.createRecipeFromDraft(draftFromPhotoPreview(preview), {
      householdId,
      createdBy: createdBy as string,
    });

    if (input.cookbookId) {
      const cookbooks = new CookbookService(db);
      const cookbook = await cookbooks.getCookbook(input.cookbookId);
      if (cookbook && cookbook.householdId === householdId) {
        await cookbooks.addRecipe(input.cookbookId, recipe.id);
      }
    }

    await recordSuccessfulDemoImport(householdId);

    const presented = presentRecipeDetailsForApi(recipe, requestApiOrigin(request));
    return createdResponse(
      {
        ...presentPhotoImportPreview(preview),
        images: presented.images,
        recipe: presented,
      },
      `/api/v1/recipes/${recipe.id}`
    );
  } catch (error) {
    return handleApiError(error, request.url);
  }
}
