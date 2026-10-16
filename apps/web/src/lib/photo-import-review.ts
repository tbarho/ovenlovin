import { keepMainRecipeImages } from "@ovenlovin/core/media";
import type { PhotoImportPreview } from "./photo-import";

export type PhotoReviewDraft = {
  title: string;
  notes: string;
  servings: string;
  prepTimeMinutes: string;
  cookTimeMinutes: string;
  sourceAttribution: string;
  ingredientsText: string;
  stepsText: string;
  images: string[];
  uncertainFields: string[];
  allergenLabels: string[];
  source: PhotoImportPreview["source"];
};

export function reviewDraftFromPreview(preview: PhotoImportPreview): PhotoReviewDraft {
  return {
    title: preview.title ?? "",
    notes: preview.notes ?? "",
    servings: preview.servings != null ? String(preview.servings) : "",
    prepTimeMinutes: preview.prepTimeMinutes != null ? String(preview.prepTimeMinutes) : "",
    cookTimeMinutes: preview.cookTimeMinutes != null ? String(preview.cookTimeMinutes) : "",
    sourceAttribution: preview.source.attribution ?? preview.source.url ?? "",
    ingredientsText: preview.ingredients.map((item) => item.rawText).join("\n"),
    stepsText: preview.steps.map((item) => item.text).join("\n"),
    images: preview.images,
    uncertainFields: preview.uncertainFields,
    allergenLabels: preview.allergenClassifications.map(
      (hit) => `${hit.ingredientText} (${hit.allergenCode})`
    ),
    source: preview.source,
  };
}

export function remoteRecipeImages(images: string[] | null | undefined): string[] {
  return keepMainRecipeImages(images).filter((image) => /^https?:\/\//i.test(image));
}

export function recipeCreateBodyFromReview(draft: PhotoReviewDraft) {
  const servings = draft.servings.trim() ? Number(draft.servings) : undefined;
  const prep = draft.prepTimeMinutes.trim() ? Number(draft.prepTimeMinutes) : undefined;
  const cook = draft.cookTimeMinutes.trim() ? Number(draft.cookTimeMinutes) : undefined;
  return {
    title: draft.title.trim() || "Untitled recipe",
    notes: draft.notes.trim() || undefined,
    servings: Number.isFinite(servings) ? servings : undefined,
    prepTimeMinutes: Number.isFinite(prep) ? prep : undefined,
    cookTimeMinutes: Number.isFinite(cook) ? cook : undefined,
    images: remoteRecipeImages(draft.images),
    ingredients: draft.ingredientsText
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((rawText) => ({ rawText })),
    steps: draft.stepsText
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((text) => ({ text })),
    source: {
      ...draft.source,
      type: "photo" as const,
      attribution: draft.sourceAttribution.trim() || draft.source.attribution,
    },
    status: draft.uncertainFields.length > 0 ? "needs_review" : "published",
  };
}

export function isImageFile(file: File): boolean {
  return file.type.startsWith("image/") || /\.(png|jpe?g|webp|gif|avif)$/i.test(file.name);
}

export function isUncertainReviewField(fields: string[], key: string): boolean {
  if (fields.includes(key)) return true;
  if (key === "times") {
    return fields.some(
      (field) => field === "times" || field.includes("prep") || field.includes("cook")
    );
  }
  if (key === "ingredients") {
    return fields.some((field) => field === "ingredients" || field.startsWith("ingredient"));
  }
  if (key === "steps") {
    return fields.some((field) => field === "steps" || field.startsWith("step"));
  }
  return false;
}
