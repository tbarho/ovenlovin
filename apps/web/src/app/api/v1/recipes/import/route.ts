import { NextRequest } from "next/server";
import {
  createPasteImporter,
  createUrlImporter,
  RecipeImportFetchError,
  RecipeNotFoundError,
} from "@ovenlovin/importers";
import {
  copyRemoteImages,
  draftFromSavedPreview,
  keepMainRecipeImages,
  prepareImportDraft,
  RecipeService,
} from "@ovenlovin/core";
import { getDatabase } from "@ovenlovin/db";
import { isAiGatewayConfigured } from "@ovenlovin/core/onboarding";
import { BadRequestError, handleApiError } from "@/lib/api/errors";
import { createdResponse, jsonResponse } from "@/lib/api/response";
import {
  getIdempotencyKey,
  getRequestContext,
  requireWritableHousehold,
  requireUserId,
} from "@/lib/api/middleware";
import { looksLikeHttpUrl } from "@/lib/import-input";
import { draftFromPlainText } from "@/lib/plain-import";
import { createVercelImagePut } from "@/lib/blob-store";
import {
  conflictFromImportResult,
  isIdempotentReplay,
  presentImportPreview,
  recipeFromPersist,
  saveImportedRecipe,
  wantsPersist,
  withDemoImportQuota,
} from "@/lib/import-save";
import { presentListedRecipe, requestApiOrigin } from "@/lib/recipe-media";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const context = await getRequestContext(request);
    const householdId = requireWritableHousehold(context);
    const createdBy = context.userId || context.clientId;
    if (!createdBy) {
      requireUserId(context);
    }

    const body = (await request.json()) as {
      source?: string;
      content?: string;
      save?: boolean | string;
      draft?: unknown;
    };
    if (body.source !== "url" && body.source !== "paste") {
      throw new BadRequestError("Provide source (url or paste) and content");
    }

    const savedDraft =
      wantsPersist(body.save) && body.draft != null ? draftFromSavedPreview(body.draft) : null;
    if (body.draft != null && wantsPersist(body.save) && !savedDraft) {
      throw new BadRequestError("That previewed draft is not a recipe");
    }

    let draft;
    if (savedDraft) {
      draft = savedDraft;
    } else {
      if (!body.content?.trim()) {
        throw new BadRequestError("Provide source (url or paste) and content");
      }
      if (body.source === "url") {
        if (!looksLikeHttpUrl(body.content)) {
          throw new BadRequestError("That doesn't look like a web address");
        }
        const importer = createUrlImporter();
        const raw = await importer.extract({ url: body.content.trim() });
        draft = await importer.toDraft(raw);
      } else if (isAiGatewayConfigured(process.env)) {
        const importer = createPasteImporter();
        const raw = await importer.extract({ text: body.content });
        draft = await importer.toDraft(raw);
      } else {
        draft = draftFromPlainText(body.content);
      }
      draft = prepareImportDraft(draft);
    }

    if (!wantsPersist(body.save)) {
      return jsonResponse(presentImportPreview(draft));
    }

    const existing = await new RecipeService(getDatabase()).findImportDuplicate(householdId, draft);
    if (existing) {
      throw conflictFromImportResult({
        outcome: "existing",
        recipe: existing.recipe,
        match: existing.match,
      });
    }

    draft.images = await copyRemoteImages(
      keepMainRecipeImages(draft.images),
      createVercelImagePut(),
      `recipes/${householdId}`
    );

    const { result, quota } = await saveImportedRecipe(draft, {
      householdId,
      createdBy: createdBy as string,
      idempotencyKey: getIdempotencyKey(request),
    });
    const recipe = recipeFromPersist(result);
    const presented = withDemoImportQuota(
      presentListedRecipe(recipe, requestApiOrigin(request)),
      quota
    );
    if (isIdempotentReplay(result)) {
      return jsonResponse(presented);
    }
    return createdResponse(presented, `/api/v1/recipes/${recipe.id}`);
  } catch (error) {
    if (error instanceof RecipeImportFetchError || error instanceof RecipeNotFoundError) {
      return handleApiError(new BadRequestError(error.message), request.url);
    }
    return handleApiError(error, request.url);
  }
}
