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

/** Replay a completed Idempotency-Key before treating the same URL or photo as a duplicate. */
export function preferCompletedImport<T>(lookups: {
  idempotency?: T | null;
  duplicate?: { recipe: T; match: ImportDuplicateMatch } | null;
}): { recipe: T; match: ImportDuplicateMatch } | null {
  if (lookups.idempotency) return { recipe: lookups.idempotency, match: "idempotency" };
  return lookups.duplicate ?? null;
}
