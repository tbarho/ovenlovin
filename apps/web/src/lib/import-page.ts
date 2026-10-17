import {
  createUrlImporter,
  RecipeImportFetchError,
  RecipeNotFoundError,
} from "@ovenlovin/importers";
import { copyRemoteImages, keepMainRecipeImages, RecipeService } from "@ovenlovin/core";
import { getDatabase } from "@ovenlovin/db";
import { createVercelImagePut } from "@/lib/blob-store";
import { recordSuccessfulDemoImport } from "@/lib/demo/enforce";
import { BadRequestError } from "@/lib/api/errors";
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
    const recipe = await new RecipeService(getDatabase()).createRecipeFromDraft(draft, {
      householdId,
      createdBy,
    });
    await recordSuccessfulDemoImport(householdId);
    return recipe;
  } catch (error) {
    if (error instanceof RecipeImportFetchError || error instanceof RecipeNotFoundError) {
      throw new BadRequestError(error.message);
    }
    throw error;
  }
}
