import { NextRequest } from "next/server";
import { handleApiError, NotFoundError } from "@/lib/api/errors";
import { jsonResponse, paginatedResponse, createdResponse } from "@/lib/api/response";
import {
  getRequestContext,
  requireHouseholdId,
  requireWritableHousehold,
  getIdempotencyKey,
} from "@/lib/api/middleware";
import {
  assertAllowedRecipeImageUrls,
  createRecipeBodySchema,
  parseRecipeImages,
  RecipeService,
} from "@ovenlovin/core";
import { readJsonBody } from "@/lib/api/read-json";
import { getDatabase } from "@ovenlovin/db";
import {
  isIdempotentReplay,
  recipeFromPersist,
  saveImportedRecipe,
  withDemoImportQuota,
} from "@/lib/import-save";
import {
  excludeRecipesBlockedForAttendees,
  parseForAttendeesParam,
} from "@/lib/recipe-attendee-filter";
import { scheduleInlineImageBackfill } from "@/lib/inline-image-backfill";
import { presentListedRecipe, requestApiOrigin } from "@/lib/recipe-media";

export async function GET(request: NextRequest) {
  try {
    const context = await getRequestContext(request);
    const householdId = requireHouseholdId(context);

    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get("limit") || "20");
    const cursor = url.searchParams.get("cursor") || undefined;
    const status = url.searchParams.get("status") || undefined;
    const search = url.searchParams.get("search") || undefined;
    const cookbookId = url.searchParams.get("cookbookId") || undefined;
    const uncategorized = url.searchParams.get("uncategorized") === "true";

    const db = getDatabase();
    const service = new RecipeService(db);
    scheduleInlineImageBackfill(service);

    const result = await service.listRecipes(householdId, {
      status,
      search,
      cookbookId,
      uncategorized,
      pagination: { limit, cursor },
    });
    const origin = requestApiOrigin(request);
    const items = result.items.map((item) => presentListedRecipe(item, origin));

    const forAttendees = parseForAttendeesParam(url.searchParams.getAll("forAttendees"));
    if (forAttendees.length > 0) {
      const { items: visible, hidden } = await excludeRecipesBlockedForAttendees(
        items,
        forAttendees,
        householdId
      );
      return jsonResponse({
        ...result,
        items: visible,
        hiddenCount: hidden.length,
        hidden,
      });
    }

    return paginatedResponse({ ...result, items });
  } catch (error) {
    return handleApiError(error, request.url);
  }
}

export async function POST(request: NextRequest) {
  try {
    const context = await getRequestContext(request);
    const householdId = requireWritableHousehold(context);
    const idempotencyKey = getIdempotencyKey(request);

    const body = await readJsonBody(request, createRecipeBodySchema);
    const images = parseRecipeImages(body.images);
    assertAllowedRecipeImageUrls(images);

    const createdBy = context.userId || context.clientId || "system";
    const ingredients = (body.ingredients ?? []).map((item) => ({ rawText: item.rawText }));
    const steps = (body.steps ?? []).map((item) => ({ text: item.text }));

    const { result, quota } = await saveImportedRecipe(
      {
        title: body.title,
        description: body.description,
        notes: body.notes,
        servings: body.servings,
        prepTimeMinutes: body.prepTimeMinutes,
        cookTimeMinutes: body.cookTimeMinutes,
        totalTimeMinutes: body.totalTimeMinutes,
        cuisine: body.cuisine,
        course: body.course,
        images,
        ingredients,
        steps,
        source: {
          type: body.source?.type ?? "manual",
          url: body.source?.url,
          canonicalUrl: body.source?.canonicalUrl,
          author: body.source?.author,
          importerName: body.source?.importerName ?? "rest-create",
          importerVersion: body.source?.importerVersion ?? "1",
          rawExtractionJson: body.source?.rawExtractionJson ?? { via: "POST /api/v1/recipes" },
        },
        needsReview: body.status === "needs_review" || body.status === "draft",
        reviewReasons: body.reviewReasons,
        uncertainFields: body.uncertainFields,
      },
      { householdId, createdBy, idempotencyKey }
    );
    const details = recipeFromPersist(result);

    if (body.cookbookId && result.outcome === "created") {
      const { CookbookService } = await import("@ovenlovin/core");
      const cookbooks = new CookbookService(getDatabase());
      const cookbook = await cookbooks.getCookbook(body.cookbookId);
      if (cookbook && cookbook.householdId === householdId) {
        await cookbooks.addRecipe(body.cookbookId, details.id);
      }
    }

    const presented = withDemoImportQuota(
      presentListedRecipe(details, requestApiOrigin(request)),
      quota
    );
    if (isIdempotentReplay(result)) {
      return jsonResponse(presented);
    }
    return createdResponse(presented, `/api/v1/recipes/${details.id}`);
  } catch (error) {
    return handleApiError(error, request.url);
  }
}
