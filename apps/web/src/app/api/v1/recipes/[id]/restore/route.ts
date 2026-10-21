import { NextRequest } from "next/server";
import { handleApiError, NotFoundError } from "@/lib/api/errors";
import { jsonResponse } from "@/lib/api/response";
import { getRequestContext, requireWritableHousehold } from "@/lib/api/middleware";
import { RecipeService } from "@ovenlovin/core";
import { getDatabase } from "@ovenlovin/db";
import { loadOwned } from "@/lib/api/owned";
import { presentRecipeDetailsForApi, requestApiOrigin } from "@/lib/recipe-media";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await getRequestContext(request);
    const householdId = requireWritableHousehold(context);
    const { id } = await params;
    const service = new RecipeService(getDatabase());
    await loadOwned("Recipe", id, householdId, (recipeId) =>
      service.getRecipeIncludingDeleted(recipeId)
    );

    const restored = await service.restoreRecipe(id);
    if (!restored) throw new NotFoundError("Recipe", id);
    const recipe = await service.getRecipeDetails(id);
    if (!recipe) throw new NotFoundError("Recipe", id);
    return jsonResponse(presentRecipeDetailsForApi(recipe, requestApiOrigin(request)));
  } catch (error) {
    return handleApiError(error, request.url);
  }
}
