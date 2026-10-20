export function asStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item).trim()).filter((item) => item.length > 0);
}

export function reviewMetadataFromJson(raw: Record<string, unknown> | null | undefined): {
  reviewReasons: string[];
  uncertainFields: string[];
} {
  return {
    reviewReasons: asStringList(raw?.reviewReasons),
    uncertainFields: asStringList(raw?.uncertainFields),
  };
}

export function ensureReviewMetadata(input: {
  needsReview?: boolean;
  reviewReasons?: string[];
  uncertainFields?: string[];
  rawExtractionJson?: Record<string, unknown> | null;
}): {
  reviewReasons: string[];
  uncertainFields: string[];
  rawExtractionJson: Record<string, unknown>;
} {
  const existing = reviewMetadataFromJson(input.rawExtractionJson);
  const uncertainFields = input.uncertainFields?.length
    ? [...new Set(input.uncertainFields)]
    : existing.uncertainFields;
  let reviewReasons = input.reviewReasons?.length
    ? [...new Set(input.reviewReasons)]
    : existing.reviewReasons;
  if (input.needsReview && reviewReasons.length === 0) {
    reviewReasons =
      uncertainFields.length > 0
        ? [`Uncertain fields: ${uncertainFields.join(", ")}`]
        : ["This imported recipe needs a human check before cooking."];
  }
  return {
    reviewReasons,
    uncertainFields,
    rawExtractionJson: {
      ...(input.rawExtractionJson ?? {}),
      reviewReasons,
      uncertainFields,
    },
  };
}
