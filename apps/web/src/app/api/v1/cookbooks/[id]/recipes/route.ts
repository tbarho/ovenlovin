import { NextRequest } from "next/server";
import { addCookbookRecipeBodySchema, CookbookService, RecipeService } from "@ovenlovin/core";
import { readJsonBody } from "@/lib/api/read-json";
import { getDatabase } from "@ovenlovin/db";
import { BadRequestError, handleApiError } from "@/lib/api/errors";
import { loadOwnedCookbook } from "@/lib/api/cookbooks";
import { loadOwned } from "@/lib/api/owned";
import { jsonResponse, noContentResponse } from "@/lib/api/response";
import { getRequestContext, requireWritableHousehold } from "@/lib/api/middleware";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await getRequestContext(request);
    const householdId = requireWritableHousehold(context);
    const { id } = await params;
    await loadOwnedCookbook(id, householdId);
    const body = await readJsonBody(request, addCookbookRecipeBodySchema);

    const db = getDatabase();
    await loadOwned("Recipe", body.recipeId, householdId, (recipeId) =>
      new RecipeService(db).getRecipe(recipeId)
    );

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
    await loadOwned("Recipe", recipeId, householdId, (ownedRecipeId) =>
      new RecipeService(getDatabase()).getRecipe(ownedRecipeId)
    );

    await new CookbookService(getDatabase()).removeRecipe(id, recipeId);
    return noContentResponse();
  } catch (error) {
    return handleApiError(error, request.url);
  }
}
