import type { RecipeImportDraft } from "../schemas/recipes";
import { ensureReviewMetadata } from "./import-review";
import { cleanImportedTitle } from "./import-title";
import { normalizeSourceUrl } from "./source-url";

export type ImportDedupeKind = "idempotency" | "photo_sha" | "photo_phash" | "source_url";

export type ImportDuplicateMatch =
  "idempotency" | "photo" | "photo_near" | "source_url" | "in_flight";

export function matchFromDedupeKind(kind: ImportDedupeKind): ImportDuplicateMatch {
  if (kind === "photo_sha") return "photo";
  if (kind === "photo_phash") return "photo_near";
  if (kind === "source_url") return "source_url";
  return "idempotency";
}

export function prepareImportDraft(draft: RecipeImportDraft): RecipeImportDraft {
  const cleaned = cleanImportedTitle(draft.title || "");
  const title = cleaned || draft.title || "Untitled recipe";
  const sourceUrl = draft.source.url ?? draft.source.canonicalUrl ?? "";
  const normalized = sourceUrl ? normalizeSourceUrl(sourceUrl) : null;
  const review = ensureReviewMetadata({
    needsReview: draft.needsReview,
    reviewReasons: draft.reviewReasons,
    uncertainFields: draft.uncertainFields,
    rawExtractionJson: {
      ...(draft.source.rawExtractionJson ?? {}),
      ...(normalized ? { sourceUrlNormalized: normalized } : {}),
    },
  });
  return {
    ...draft,
    title,
    reviewReasons: review.reviewReasons,
    uncertainFields: review.uncertainFields,
    source: {
      ...draft.source,
      canonicalUrl: draft.source.canonicalUrl ?? normalized ?? draft.source.url,
      rawExtractionJson: review.rawExtractionJson,
    },
  };
}

export function importDedupeKeys(
  draft: RecipeImportDraft,
  idempotencyKey?: string
): Array<{ kind: ImportDedupeKind; key: string }> {
  const keys: Array<{ kind: ImportDedupeKind; key: string }> = [];
  const trimmedKey = idempotencyKey?.trim();
  if (trimmedKey) keys.push({ kind: "idempotency", key: trimmedKey.slice(0, 512) });

  const raw = draft.source.rawExtractionJson ?? {};
  if (typeof raw.photoFingerprint === "string" && raw.photoFingerprint.trim()) {
    keys.push({ kind: "photo_sha", key: raw.photoFingerprint.trim().slice(0, 512) });
  }

  const url = normalizeSourceUrl(draft.source.canonicalUrl ?? draft.source.url ?? "");
  if (url && draft.source.type === "url") {
    keys.push({ kind: "source_url", key: url.slice(0, 512) });
  }
  return keys;
}

export function photoFingerprintFromDraft(draft: RecipeImportDraft): string | null {
  const value = draft.source.rawExtractionJson?.photoFingerprint;
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function photoPerceptualHashFromDraft(draft: RecipeImportDraft): string | null {
  const value = draft.source.rawExtractionJson?.photoPerceptualHash;
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

/** Persist a previewed import without extracting again. */
export function draftFromSavedPreview(value: unknown): RecipeImportDraft | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  if (typeof raw.title !== "string" || !raw.title.trim()) return null;
  if (!raw.source || typeof raw.source !== "object") return null;
  if (!Array.isArray(raw.ingredients) || !Array.isArray(raw.steps)) return null;

  const ingredients: RecipeImportDraft["ingredients"] = [];
  for (const item of raw.ingredients) {
    if (!item || typeof item !== "object") continue;
    const rawText = (item as { rawText?: unknown }).rawText;
    if (typeof rawText !== "string" || !rawText.trim()) continue;
    ingredients.push(item as RecipeImportDraft["ingredients"][number]);
  }
  const steps: RecipeImportDraft["steps"] = [];
  for (const item of raw.steps) {
    if (!item || typeof item !== "object") continue;
    const text = (item as { text?: unknown }).text;
    if (typeof text !== "string" || !text.trim()) continue;
    steps.push({ text });
  }
  if (ingredients.length === 0 || steps.length === 0) return null;

  const source = raw.source as RecipeImportDraft["source"];
  if (typeof source.importerName !== "string" || !source.importerName.trim()) return null;
  return prepareImportDraft({
    title: raw.title,
    description: typeof raw.description === "string" ? raw.description : undefined,
    notes: typeof raw.notes === "string" ? raw.notes : undefined,
    servings: typeof raw.servings === "number" ? raw.servings : undefined,
    prepTimeMinutes: typeof raw.prepTimeMinutes === "number" ? raw.prepTimeMinutes : undefined,
    cookTimeMinutes: typeof raw.cookTimeMinutes === "number" ? raw.cookTimeMinutes : undefined,
    totalTimeMinutes: typeof raw.totalTimeMinutes === "number" ? raw.totalTimeMinutes : undefined,
    cuisine: typeof raw.cuisine === "string" ? raw.cuisine : undefined,
    course: typeof raw.course === "string" ? raw.course : undefined,
    images: Array.isArray(raw.images) ? (raw.images as string[]) : undefined,
    ingredients,
    steps,
    source: {
      ...source,
      rawExtractionJson: source.rawExtractionJson ?? {},
    },
    needsReview: Boolean(raw.needsReview),
    reviewReasons: Array.isArray(raw.reviewReasons)
      ? raw.reviewReasons.filter((item): item is string => typeof item === "string")
      : undefined,
    uncertainFields: Array.isArray(raw.uncertainFields)
      ? raw.uncertainFields.filter((item): item is string => typeof item === "string")
      : undefined,
  });
}

export function sourceUrlFromDraft(draft: RecipeImportDraft): string | null {
  if (draft.source.type !== "url") return null;
  return (
    normalizeSourceUrl(
      String(draft.source.rawExtractionJson?.sourceUrlNormalized ?? "") ||
        draft.source.canonicalUrl ||
        draft.source.url ||
        ""
    ) ?? null
  );
}
