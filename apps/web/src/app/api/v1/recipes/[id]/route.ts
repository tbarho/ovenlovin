import { NextRequest } from "next/server";
import { handleApiError, NotFoundError } from "@/lib/api/errors";
import { jsonResponse, noContentResponse } from "@/lib/api/response";
import { getRequestContext, requireHouseholdId } from "@/lib/api/middleware";
import { RecipeService, type RecipeContentUpdate } from "@ovenlovin/core";
import { getDatabase } from "@ovenlovin/db";
import { assertRecipeHousehold } from "@/lib/api/recipes";
import { presentRecipeDetailsForApi, requestApiOrigin } from "@/lib/recipe-media";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await getRequestContext(request);
    const householdId = requireHouseholdId(context);
    const { id } = await params;
    const recipe = await new RecipeService(getDatabase()).getRecipeDetails(id);
    assertRecipeHousehold(recipe, householdId, id);
    return jsonResponse(presentRecipeDetailsForApi(recipe, requestApiOrigin(request)));
  } catch (error) {
    return handleApiError(error, request.url);
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await getRequestContext(request);
    const householdId = requireHouseholdId(context);
    const { id } = await params;
    const body = (await request.json()) as RecipeContentUpdate;
    const service = new RecipeService(getDatabase());
    const existing = await service.getRecipe(id);
    assertRecipeHousehold(existing, householdId, id);

    const recipe = await service.updateRecipeDetails(id, body);
    if (!recipe) throw new NotFoundError("Recipe", id);
    return jsonResponse(presentRecipeDetailsForApi(recipe, requestApiOrigin(request)));
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
    const householdId = requireHouseholdId(context);
    const { id } = await params;
    const service = new RecipeService(getDatabase());
    const existing = await service.getRecipe(id);
    assertRecipeHousehold(existing, householdId, id);

    const deleted = await service.deleteRecipe(id);
    if (!deleted) throw new NotFoundError("Recipe", id);
    return noContentResponse();
  } catch (error) {
    return handleApiError(error, request.url);
  }
}
