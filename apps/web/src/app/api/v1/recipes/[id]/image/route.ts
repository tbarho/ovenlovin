import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { handleApiError, NotFoundError, BadRequestError } from "@/lib/api/errors";
import { readJsonBody } from "@/lib/api/read-json";
import { jsonResponse } from "@/lib/api/response";
import {
  getRequestContext,
  requireHouseholdId,
  requireWritableHousehold,
} from "@/lib/api/middleware";
import { assertRecipeHousehold } from "@/lib/api/recipes";
import { createVercelImagePut } from "@/lib/blob-store";
import { presentListedRecipe, requestApiOrigin } from "@/lib/recipe-media";
import {
  isInlineImageDataUrl,
  parseImageDataUrl,
  persistRecipeImageUrl,
  recipeMainImage,
  RecipeService,
} from "@ovenlovin/core";
import { getDatabase } from "@ovenlovin/db";

const PHOTO_SAVE_MAX_BYTES = 700_000;

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

/** Store a compressed photo after recipe create. Works without Vercel Blob. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await getRequestContext(request);
    const householdId = requireWritableHousehold(context);
    const { id } = await params;
    const service = new RecipeService(getDatabase());
    const recipe = await service.getRecipe(id);
    assertRecipeHousehold(recipe, householdId, id);

    const body = await readJsonBody(request, z.object({ image: z.string().min(1) }));
    const image = body.image.trim();
    if (!isInlineImageDataUrl(image)) {
      throw new BadRequestError("Provide a compressed image data URL");
    }
    const parsed = parseImageDataUrl(image);
    if (!parsed) {
      throw new BadRequestError("Image data URL must be a base64 data URI");
    }
    if (parsed.body.byteLength > PHOTO_SAVE_MAX_BYTES) {
      throw new BadRequestError("Images must be 700KB or smaller after compress");
    }

    const stored = await persistRecipeImageUrl(
      image,
      createVercelImagePut(),
      `recipes/${householdId}/${id}/photo`
    );
    const updated = await service.updateRecipe(id, { images: [stored] });
    if (!updated) {
      throw new NotFoundError("Recipe", id);
    }
    return jsonResponse(presentListedRecipe(updated, requestApiOrigin(request)));
  } catch (error) {
    return handleApiError(error, request.url);
  }
}
