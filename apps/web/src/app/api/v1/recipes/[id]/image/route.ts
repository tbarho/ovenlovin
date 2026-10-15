import { NextRequest, NextResponse } from "next/server";
import { handleApiError, NotFoundError } from "@/lib/api/errors";
import { getRequestContext, requireHouseholdId } from "@/lib/api/middleware";
import { assertRecipeHousehold } from "@/lib/api/recipes";
import {
  isInlineImageDataUrl,
  parseImageDataUrl,
  recipeMainImage,
  RecipeService,
} from "@ovenlovin/core";
import { getDatabase } from "@ovenlovin/db";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await getRequestContext(request);
    const householdId = requireHouseholdId(context);
    const { id } = await params;
    const recipe = await new RecipeService(getDatabase()).getRecipe(id);
    assertRecipeHousehold(recipe, householdId, id);

    const stored = recipeMainImage(recipe.images);
    if (!stored) {
      throw new NotFoundError("RecipeImage", id);
    }

    if (isInlineImageDataUrl(stored)) {
      const parsed = parseImageDataUrl(stored);
      if (!parsed) {
        throw new NotFoundError("RecipeImage", id);
      }
      return new NextResponse(new Uint8Array(parsed.body), {
        status: 200,
        headers: {
          "Content-Type": parsed.contentType,
          "Cache-Control": "private, max-age=86400",
        },
      });
    }

    if (/^https?:\/\//i.test(stored)) {
      return NextResponse.redirect(stored, 302);
    }

    throw new NotFoundError("RecipeImage", id);
  } catch (error) {
    return handleApiError(error, request.url);
  }
}
