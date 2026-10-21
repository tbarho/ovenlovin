import { NextRequest } from "next/server";
import { CookbookService, RecipeService, updateCookbookBodySchema } from "@ovenlovin/core";
import { readJsonBody } from "@/lib/api/read-json";
import { getDatabase } from "@ovenlovin/db";
import { handleApiError, NotFoundError } from "@/lib/api/errors";
import { loadOwnedCookbook } from "@/lib/api/cookbooks";
import { jsonResponse, noContentResponse } from "@/lib/api/response";
import {
  getRequestContext,
  requireHouseholdId,
  requireWritableHousehold,
} from "@/lib/api/middleware";
import { presentListedRecipe, requestApiOrigin } from "@/lib/recipe-media";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await getRequestContext(request);
    const householdId = requireHouseholdId(context);
    const { id } = await params;
    const cookbook = await loadOwnedCookbook(id, householdId);
    const db = getDatabase();
    const recipes = await new RecipeService(db).listRecipes(householdId, {
      cookbookId: id,
      pagination: { limit: 100 },
    });

    return jsonResponse({
      ...cookbook,
      recipes: recipes.items.map((item) => presentListedRecipe(item, requestApiOrigin(request))),
    });
  } catch (error) {
    return handleApiError(error, request.url);
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await getRequestContext(request);
    const householdId = requireWritableHousehold(context);
    const { id } = await params;
    await loadOwnedCookbook(id, householdId);
    const body = await readJsonBody(request, updateCookbookBodySchema);

    const updated = await new CookbookService(getDatabase()).updateCookbook(id, body);
    if (!updated) throw new NotFoundError("Cookbook", id);
    return jsonResponse(updated);
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
    const deleted = await new CookbookService(getDatabase()).deleteCookbook(id);
    if (!deleted) throw new NotFoundError("Cookbook", id);
    return noContentResponse();
  } catch (error) {
    return handleApiError(error, request.url);
  }
}
