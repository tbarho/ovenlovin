import { NextRequest } from "next/server";
import { handleApiError, NotFoundError } from "@/lib/api/errors";
import { jsonResponse, paginatedResponse, createdResponse } from "@/lib/api/response";
import { getRequestContext, requireHouseholdId, getIdempotencyKey } from "@/lib/api/middleware";
import { RecipeService } from "@ovenlovin/core";
import { getDatabase } from "@ovenlovin/db";

export async function GET(request: NextRequest) {
  try {
    const context = await getRequestContext(request);
    const householdId = requireHouseholdId(context);

    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get("limit") || "20");
    const cursor = url.searchParams.get("cursor") || undefined;
    const status = url.searchParams.get("status") || undefined;
    const search = url.searchParams.get("search") || undefined;

    const db = getDatabase();
    const service = new RecipeService(db);

    const result = await service.listRecipes(householdId, {
      status,
      search,
      pagination: { limit, cursor },
    });

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
