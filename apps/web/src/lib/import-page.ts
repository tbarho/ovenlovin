import {
  createUrlImporter,
  RecipeImportFetchError,
  RecipeNotFoundError,
} from "@ovenlovin/importers";
import { copyRemoteImages, keepMainRecipeImages } from "@ovenlovin/core";
import { createVercelImagePut } from "@/lib/blob-store";
import { BadRequestError } from "@/lib/api/errors";
import { recipeFromPersist, saveImportedRecipe } from "@/lib/import-save";
import {
  parseCapturedPage as parseCapturedPageInput,
  parseCaptureHash as parseCaptureHashInput,
  type CapturedPageInput,
} from "./import-captured";

export type { CapturedPageInput };

function captureInputOrBadRequest<T>(run: () => T): T {
  try {
    return run();
  } catch (error) {
    throw new BadRequestError(error instanceof Error ? error.message : "Bad request");
  }
}

export function parseCapturedPage(body: unknown): CapturedPageInput {
  return captureInputOrBadRequest(() => parseCapturedPageInput(body));
}

export function parseCaptureHash(hash: string): CapturedPageInput {
  return captureInputOrBadRequest(() => parseCaptureHashInput(hash));
}

export async function importCapturedPage(
  input: CapturedPageInput,
  householdId: string,
  createdBy: string
) {
  const importer = createUrlImporter();
  try {
    const raw = await importer.extract({
      url: input.url,
      html: input.html,
      jsonLd: input.jsonLd,
    });
    const draft = await importer.toDraft(raw);
    draft.images = await copyRemoteImages(
      keepMainRecipeImages(draft.images),
      createVercelImagePut(),
      `recipes/${householdId}`
    );
    const { result } = await saveImportedRecipe(draft, {
      householdId,
      createdBy,
    });
    return recipeFromPersist(result);
  } catch (error) {
    if (error instanceof RecipeImportFetchError || error instanceof RecipeNotFoundError) {
      throw new BadRequestError(error.message);
    }
    throw error;
  }
}
