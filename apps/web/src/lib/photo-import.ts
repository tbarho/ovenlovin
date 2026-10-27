import { createHash } from "node:crypto";
import {
  assertAllowedRecipeImageUrls,
  copyRemoteImages,
  ensureReviewMetadata,
  fingerprintImageBlob,
  keepMainRecipeImages,
  omitInlineImagePayloads,
  persistRecipeImageUrl,
  presentPhotoImportImages,
  type RecipeImportDraft,
  type StoredImagePut,
} from "@ovenlovin/core";
import { perceptualHashFromImageBlob } from "@ovenlovin/core/photo-hash";
import { runPhotoImport, type DraftAllergenHit, type RecipeDraft } from "@ovenlovin/importers";

export const PHOTO_IMPORT_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/avif",
]);

export type PhotoImageInput = { blob: string; filename?: string };

export type PhotoImportPreview = {
  saved?: boolean;
  preview?: boolean;
  possibleDuplicate?: { recipeId: string; title: string };
  title: string;
  description?: string;
  notes?: string;
  servings?: number;
  prepTimeMinutes?: number;
  cookTimeMinutes?: number;
  totalTimeMinutes?: number;
  cuisine?: string;
  course?: string;
  ingredients: Array<{
    rawText: string;
    name?: string;
    quantityMin?: number | null;
    quantityMax?: number | null;
    unit?: string | null;
    confidence?: number;
  }>;
  steps: Array<{ text: string }>;
  images: string[];
  source: RecipeImportDraft["source"];
  overallConfidence: number;
  needsReview: boolean;
  reviewReasons: string[];
  uncertainFields: string[];
  allergenClassifications: DraftAllergenHit[];
  modelUsed?: string;
};

export function asImageDataUrl(value: string, mimeType = "image/jpeg"): string {
  const trimmed = value.trim();
  if (trimmed.startsWith("data:")) return trimmed;
  const payload = trimmed.replace(/^data:[^,]*,/, "").replace(/\s+/g, "");
  return `data:${mimeType};base64,${payload}`;
}

export function collectPhotoImages(body: {
  imageUrl?: string;
  imageUrls?: string[];
  imageBase64?: string;
  mimeType?: string;
  images?: Array<{ url?: string; base64?: string; mimeType?: string; filename?: string }>;
}): PhotoImageInput[] {
  const collected: PhotoImageInput[] = [];

  for (const url of [body.imageUrl, ...(body.imageUrls ?? [])]) {
    if (url?.trim()) collected.push({ blob: url.trim() });
  }

  if (body.imageBase64?.trim()) {
    collected.push({ blob: asImageDataUrl(body.imageBase64, body.mimeType) });
  }

  for (const image of body.images ?? []) {
    if (image.url?.trim()) {
      collected.push({ blob: image.url.trim(), filename: image.filename });
    } else if (image.base64?.trim()) {
      collected.push({
        blob: asImageDataUrl(image.base64, image.mimeType ?? body.mimeType),
        filename: image.filename,
      });
    }
  }

  return collected;
}

export function parseDataUrl(dataUrl: string): { contentType: string; body: ArrayBuffer } {
  const match = dataUrl.match(/^data:([^;,]+);base64,(.+)$/);
  if (!match?.[1] || !match[2]) {
    throw new Error("Image data URL must be a base64 data URI");
  }
  const contentType = match[1];
  const bytes = Buffer.from(match[2], "base64");
  return {
    contentType,
    body: bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
  };
}

export async function fileToImageInput(file: File): Promise<PhotoImageInput> {
  const type = file.type || "image/jpeg";
  if (!PHOTO_IMPORT_MIME_TYPES.has(type)) {
    throw new Error("Use a JPEG, PNG, WebP, GIF, or AVIF image");
  }
  const buffer = Buffer.from(await file.arrayBuffer());
  return {
    blob: `data:${type};base64,${buffer.toString("base64")}`,
    filename: file.name,
  };
}

export async function persistMainPhoto(
  images: PhotoImageInput[],
  householdId: string,
  put: StoredImagePut | undefined
): Promise<string[]> {
  const first = images[0]?.blob;
  if (!first) return [];

  if (first.startsWith("data:")) {
    const stored = await persistRecipeImageUrl(first, put, `recipes/${householdId}/photo-import/1`);
    return keepMainRecipeImages([stored]);
  }

  return copyRemoteImages(keepMainRecipeImages([first]), put, `recipes/${householdId}`);
}

export function previewFromDraft(draft: RecipeDraft, images: string[]): PhotoImportPreview {
  return {
    title: draft.title,
    description: draft.description,
    notes: draft.notes,
    servings: draft.servings,
    prepTimeMinutes: draft.prepTimeMinutes,
    cookTimeMinutes: draft.cookTimeMinutes,
    totalTimeMinutes: draft.totalTimeMinutes,
    cuisine: draft.cuisine,
    course: draft.course,
    ingredients: draft.ingredients.map((ingredient) => ({
      rawText: ingredient.rawText,
      name: ingredient.ingredient,
      quantityMin: ingredient.quantity?.min ?? null,
      quantityMax: ingredient.quantity?.max ?? null,
      unit: ingredient.unit ?? null,
      confidence: ingredient.confidence,
    })),
    steps: draft.steps.map((step) => ({ text: step.text })),
    images: keepMainRecipeImages(images),
    source: {
      ...draft.source,
      blobRefs: omitInlineImagePayloads([
        ...(draft.source.blobRefs ?? []),
        ...keepMainRecipeImages(images),
      ]),
    },
    overallConfidence: draft.overallConfidence,
    needsReview: draft.needsReview,
    reviewReasons: draft.reviewReasons,
    uncertainFields: draft.uncertainFields ?? [],
    allergenClassifications: draft.allergenClassifications ?? [],
    modelUsed: draft.source.modelUsed,
  };
}

export function presentPhotoImportPreview(preview: PhotoImportPreview): PhotoImportPreview {
  return {
    ...preview,
    images: presentPhotoImportImages(preview.images),
    source: {
      ...preview.source,
      blobRefs: omitInlineImagePayloads(preview.source.blobRefs),
    },
  };
}

export function draftFromPhotoPreview(preview: PhotoImportPreview): RecipeImportDraft {
  const needsReview = preview.needsReview || preview.uncertainFields.length > 0;
  const review = ensureReviewMetadata({
    needsReview,
    reviewReasons: preview.reviewReasons,
    uncertainFields: preview.uncertainFields,
    rawExtractionJson: preview.source.rawExtractionJson ?? { via: "photo-import" },
  });
  return {
    title: preview.title || "Untitled recipe",
    description: preview.description,
    notes: preview.notes,
    servings: preview.servings,
    prepTimeMinutes: preview.prepTimeMinutes,
    cookTimeMinutes: preview.cookTimeMinutes,
    totalTimeMinutes: preview.totalTimeMinutes,
    cuisine: preview.cuisine,
    course: preview.course,
    images: keepMainRecipeImages(preview.images),
    ingredients: preview.ingredients
      .filter((ingredient) => ingredient.rawText.trim().length > 0)
      .map((ingredient) => ({
        rawText: ingredient.rawText,
        quantity:
          ingredient.quantityMin != null
            ? { min: ingredient.quantityMin, max: ingredient.quantityMax ?? undefined }
            : undefined,
        unit: ingredient.unit ?? undefined,
        confidence: ingredient.confidence,
      })),
    steps: preview.steps
      .filter((step) => step.text.trim().length > 0)
      .map((step) => ({ text: step.text })),
    source: {
      ...preview.source,
      type: "photo",
      importerName: preview.source.importerName || "photo-importer",
      importerVersion: preview.source.importerVersion || "0.1.0",
      rawExtractionJson: review.rawExtractionJson,
    },
    needsReview,
    reviewReasons: review.reviewReasons,
    uncertainFields: review.uncertainFields,
  };
}

export function classifyPhotoImportPreview(
  preview: PhotoImportPreview
): "blurry" | "not_recipe" | null {
  const raw = preview.source.rawExtractionJson ?? {};
  const quality = typeof raw.ocrQuality === "string" ? raw.ocrQuality : "";
  const looksLike = raw.looksLikeRecipe;
  const empty = preview.ingredients.length === 0 && preview.steps.length === 0;
  if (looksLike === false) return "not_recipe";
  if (quality === "poor" && empty) return "blurry";
  if (empty && !preview.title.trim()) return "not_recipe";
  return null;
}

/** Fingerprints every page in order; one page keeps the legacy single-image key. */
export function photoImportFingerprint(blobs: string[]): string | null {
  if (blobs.length === 0) return null;
  if (blobs.length === 1) return fingerprintImageBlob(blobs[0]!);
  const joined = blobs.map(fingerprintImageBlob).join("|");
  return `pages:sha256:${createHash("sha256").update(joined).digest("hex")}`;
}

/** Near-match only single photos; page 1 alone can look like another recipe from the same book. */
export function photoImportPerceptualHash(blobs: string[]): string | undefined {
  if (blobs.length !== 1) return undefined;
  return perceptualHashFromImageBlob(blobs[0]!) ?? undefined;
}

export async function extractPhotoPreview(
  images: PhotoImageInput[],
  options: {
    householdId: string;
    isHandwritten?: boolean;
    put?: StoredImagePut;
    abortSignal?: AbortSignal;
  }
): Promise<PhotoImportPreview> {
  assertAllowedRecipeImageUrls(images.map((image) => image.blob));
  const extracted = await runPhotoImport(
    { images, isHandwritten: options.isHandwritten },
    {
      abortSignal: options.abortSignal,
    }
  );
  const hero = recipeHeroFromPhotoDraft(
    extracted.draft.images,
    images.map((image) => image.blob)
  );
  extracted.draft.images =
    hero.length > 0
      ? await persistMainPhoto(
          hero.map((blob) => ({ blob })),
          options.householdId,
          options.put
        )
      : [];
  const fingerprint = photoImportFingerprint(images.map((image) => image.blob));
  if (fingerprint) {
    extracted.draft.source = {
      ...extracted.draft.source,
      rawExtractionJson: {
        ...(extracted.draft.source.rawExtractionJson ?? {}),
        photoFingerprint: fingerprint,
        photoPerceptualHash: photoImportPerceptualHash(images.map((image) => image.blob)),
      },
    };
  }
  return previewFromDraft(extracted.draft, extracted.draft.images);
}

/** Photographed cards are source material, not the recipe hero. */
export function recipeHeroFromPhotoDraft(
  extractedImages: string[] | undefined,
  photographed: string[] = []
): string[] {
  const cards = new Set(photographed);
  return keepMainRecipeImages((extractedImages ?? []).filter((url) => !cards.has(url)));
}
