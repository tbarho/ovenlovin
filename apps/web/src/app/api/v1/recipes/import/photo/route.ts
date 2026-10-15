import { NextRequest } from "next/server";
import { CookbookService, RecipeService } from "@ovenlovin/core";
import { AI_GATEWAY_MISSING_MESSAGE, isAiGatewayConfigured } from "@ovenlovin/core/onboarding";
import { getDatabase } from "@ovenlovin/db";
import { BadRequestError, handleApiError } from "@/lib/api/errors";
import { createdResponse, jsonResponse } from "@/lib/api/response";
import { getRequestContext, requireHouseholdId, requireUserId } from "@/lib/api/middleware";
import { createVercelImagePut } from "@/lib/blob-store";
import { recordSuccessfulDemoImport } from "@/lib/demo/enforce";
import { readPhotoImportRequest } from "@/lib/photo-import-request";
import { draftFromPhotoPreview, extractPhotoPreview } from "@/lib/photo-import";

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
    const preview = await extractPhotoPreview(input.images, {
      householdId,
      isHandwritten: input.isHandwritten,
      put: createVercelImagePut(),
    });

    if (!input.save) {
      return jsonResponse(preview);
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

    return createdResponse({ ...preview, recipe }, `/api/v1/recipes/${recipe.id}`);
  } catch (error) {
    return handleApiError(error, request.url);
  }
}
