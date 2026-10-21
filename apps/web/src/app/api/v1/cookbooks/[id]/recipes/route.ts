import { NextRequest } from "next/server";
import { addCookbookRecipeBodySchema, CookbookService, RecipeService } from "@ovenlovin/core";
import { readJsonBody } from "@/lib/api/read-json";
import { getDatabase } from "@ovenlovin/db";
import { BadRequestError, ForbiddenError, handleApiError, NotFoundError } from "@/lib/api/errors";
import { jsonResponse, noContentResponse } from "@/lib/api/response";
import {
  getRequestContext,
  requireHouseholdId,
  requireWritableHousehold,
} from "@/lib/api/middleware";
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
    const householdId = requireWritableHousehold(context);
    const { id } = await params;
    await loadOwnedCookbook(id, householdId);
    const body = await readJsonBody(request, addCookbookRecipeBodySchema);

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
    const householdId = requireWritableHousehold(context);
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
