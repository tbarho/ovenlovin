import { NextRequest } from "next/server";
import { handleApiError, NotFoundError } from "@/lib/api/errors";
import { jsonResponse, noContentResponse } from "@/lib/api/response";
import { getRequestContext, requireHouseholdId } from "@/lib/api/middleware";
import { RecipeService } from "@ovenlovin/core";
import { getDatabase } from "@ovenlovin/db";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const context = await getRequestContext(request);
    requireHouseholdId(context);

    const { id } = await params;

    const db = getDatabase();
    const service = new RecipeService(db);

    const recipe = await service.getRecipe(id);

    if (!recipe) {
      throw new NotFoundError("Recipe", id);
    }

    return jsonResponse(recipe);
  } catch (error) {
    return handleApiError(error, request.url);
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const context = await getRequestContext(request);
    requireHouseholdId(context);

    const { id } = await params;
    const body = await request.json();

    const db = getDatabase();
    const service = new RecipeService(db);

    const recipe = await service.updateRecipe(id, body);

    if (!recipe) {
      throw new NotFoundError("Recipe", id);
    }

    return jsonResponse(recipe);
  } catch (error) {
    return handleApiError(error, request.url);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const context = await getRequestContext(request);
    requireHouseholdId(context);

    const { id } = await params;

    const db = getDatabase();
    const service = new RecipeService(db);

    const deleted = await service.deleteRecipe(id);

    if (!deleted) {
      throw new NotFoundError("Recipe", id);
    }

    return noContentResponse();
  } catch (error) {
    return handleApiError(error, request.url);
  }
}
