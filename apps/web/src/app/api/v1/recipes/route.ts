import { NextRequest } from "next/server";
import { handleApiError, NotFoundError } from "@/lib/api/errors";
import { jsonResponse, paginatedResponse, createdResponse } from "@/lib/api/response";
import { getRequestContext, requireHouseholdId, getIdempotencyKey } from "@/lib/api/middleware";
import { RecipeService } from "@ovenlovin/core";
import { getDatabase } from "@ovenlovin/db";
import {
  excludeRecipesBlockedForAttendees,
  parseForAttendeesParam,
} from "@/lib/recipe-attendee-filter";

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

    const result = await service.listRecipes(householdId, {
      status,
      search,
      cookbookId,
      uncategorized,
      pagination: { limit, cursor },
    });

    const forAttendees = parseForAttendeesParam(url.searchParams.getAll("forAttendees"));
    if (forAttendees.length > 0) {
      const visible = await excludeRecipesBlockedForAttendees(
        result.items,
        forAttendees,
        householdId
      );
      return paginatedResponse({ ...result, items: visible });
    }

    return paginatedResponse(result);
  } catch (error) {
    return handleApiError(error, request.url);
  }
}

export async function POST(request: NextRequest) {
  try {
    const context = await getRequestContext(request);
    const householdId = requireHouseholdId(context);
    const idempotencyKey = getIdempotencyKey(request);

    const body = await request.json();

    const db = getDatabase();
    const service = new RecipeService(db);

    const createdBy = context.userId || context.clientId || "system";

    if (typeof body.title === "string" && body.title.trim()) {
      const ingredients = Array.isArray(body.ingredients)
        ? body.ingredients
            .map((item: { rawText?: string }) => ({ rawText: String(item?.rawText ?? "").trim() }))
            .filter((item: { rawText: string }) => item.rawText.length > 0)
        : [];
      const steps = Array.isArray(body.steps)
        ? body.steps
            .map((item: { text?: string }) => ({ text: String(item?.text ?? "").trim() }))
            .filter((item: { text: string }) => item.text.length > 0)
        : [];

      const details = await service.createRecipeFromDraft(
        {
          title: body.title,
          description: body.description,
          servings: body.servings,
          prepTimeMinutes: body.prepTimeMinutes,
          cookTimeMinutes: body.cookTimeMinutes,
          totalTimeMinutes: body.totalTimeMinutes,
          cuisine: body.cuisine,
          course: body.course,
          images: Array.isArray(body.images) ? body.images : [],
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
        },
        { householdId, createdBy }
      );

      if (typeof body.cookbookId === "string") {
        const { CookbookService } = await import("@ovenlovin/core");
        const cookbooks = new CookbookService(db);
        const cookbook = await cookbooks.getCookbook(body.cookbookId);
        if (cookbook && cookbook.householdId === householdId) {
          await cookbooks.addRecipe(body.cookbookId, details.id);
        }
      }

      return createdResponse(details, `/api/v1/recipes/${details.id}`);
    }

    const recipe = await service.createRecipe({
      ...body,
      householdId,
      createdBy,
    });

    return createdResponse(recipe, `/api/v1/recipes/${recipe.id}`);
  } catch (error) {
    return handleApiError(error, request.url);
  }
}
