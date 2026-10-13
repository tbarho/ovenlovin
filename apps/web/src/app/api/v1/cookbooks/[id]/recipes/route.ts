import { NextRequest } from "next/server";
import { CookbookService, RecipeService } from "@ovenlovin/core";
import { getDatabase } from "@ovenlovin/db";
import { BadRequestError, ForbiddenError, handleApiError, NotFoundError } from "@/lib/api/errors";
import { jsonResponse, noContentResponse } from "@/lib/api/response";
import { getRequestContext, requireHouseholdId } from "@/lib/api/middleware";
import { assertRecipeHousehold } from "@/lib/api/recipes";

async function loadOwnedCookbook(id: string, householdId: string) {
  const cookbook = await new CookbookService(getDatabase()).getCookbook(id);
  if (!cookbook) throw new NotFoundError("Cookbook", id);
  if (cookbook.householdId !== householdId) {
    throw new ForbiddenError("Cookbook is not in this household");
  }
  return cookbook;
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await getRequestContext(request);
    const householdId = requireHouseholdId(context);
    const { id } = await params;
    await loadOwnedCookbook(id, householdId);
    const body = (await request.json()) as { recipeId?: string };
    if (!body.recipeId) throw new BadRequestError("recipeId is required");

    const db = getDatabase();
    const recipe = await new RecipeService(db).getRecipe(body.recipeId);
    assertRecipeHousehold(recipe, householdId, body.recipeId);

    await new CookbookService(db).addRecipe(id, body.recipeId);
    return jsonResponse({ cookbookId: id, recipeId: body.recipeId });
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
    await loadOwnedCookbook(id, householdId);
    const url = new URL(request.url);
    const recipeId = url.searchParams.get("recipeId");
    if (!recipeId) throw new BadRequestError("recipeId query parameter is required");

    await new CookbookService(getDatabase()).removeRecipe(id, recipeId);
    return noContentResponse();
  } catch (error) {
    return handleApiError(error, request.url);
  }
}
