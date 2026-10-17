import {
  createUrlImporter,
  RecipeImportFetchError,
  RecipeNotFoundError,
} from "@ovenlovin/importers";
import { copyRemoteImages, keepMainRecipeImages, RecipeService } from "@ovenlovin/core";
import { getDatabase } from "@ovenlovin/db";
import { createVercelImagePut } from "@/lib/blob-store";
import { recordSuccessfulDemoImport } from "@/lib/demo/enforce";
import { looksLikeHttpUrl } from "@/lib/import-input";
import { BadRequestError } from "@/lib/api/errors";

export type CapturedPageInput = {
  url: string;
  html?: string;
  jsonLd?: Record<string, unknown>;
};

export function parseCapturedPage(body: unknown): CapturedPageInput {
  const record = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const url = typeof record.url === "string" ? record.url.trim() : "";
  if (!looksLikeHttpUrl(url)) {
    throw new BadRequestError("Provide the recipe page URL");
  }

  let jsonLd: Record<string, unknown> | undefined;
  if (typeof record.jsonLd === "string" && record.jsonLd.trim()) {
    try {
      const parsed = JSON.parse(record.jsonLd) as unknown;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        jsonLd = parsed as Record<string, unknown>;
      }
    } catch {
      throw new BadRequestError("jsonLd must be a JSON object");
    }
  } else if (record.jsonLd && typeof record.jsonLd === "object" && !Array.isArray(record.jsonLd)) {
    jsonLd = record.jsonLd as Record<string, unknown>;
  }

  const html = typeof record.html === "string" ? record.html : undefined;
  if (!html?.trim() && !jsonLd) {
    throw new BadRequestError("Provide the page HTML or JSON-LD recipe");
  }

  return { url, html, jsonLd };
}

export function parseCaptureHash(hash: string): CapturedPageInput {
  const raw = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!raw.trim()) {
    throw new BadRequestError("No page was sent. Open a recipe, then tap Save to OvenLovin.");
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(decodeURIComponent(raw));
  } catch {
    throw new BadRequestError("The bookmarklet payload was not valid JSON");
  }
  return parseCapturedPage(parsed);
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
