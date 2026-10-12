import type { ConfidenceScore, RecipeDraft } from "../types/importer";

/**
 * Calculate overall confidence score from parsed fields
 */
export function calculateOverallConfidence(
  draft: Omit<RecipeDraft, "overallConfidence" | "needsReview" | "reviewReasons">
): {
  overallConfidence: ConfidenceScore;
  needsReview: boolean;
  reviewReasons: string[];
} {
  const scores: ConfidenceScore[] = [];
  const reasons: string[] = [];

  for (const ingredient of draft.ingredients) {
    scores.push(ingredient.confidence);
    if (ingredient.confidence < 0.6 && ingredient.confidenceReasons) {
      reasons.push(...ingredient.confidenceReasons.map((r) => `Ingredient: ${r}`));
    }
  }

  for (const step of draft.steps) {
    scores.push(step.confidence);
    if (step.confidence < 0.6 && step.confidenceReasons) {
      reasons.push(...step.confidenceReasons.map((r) => `Step: ${r}`));
    }
  }

  if (!draft.title || draft.title.length === 0) {
    scores.push(0);
    reasons.push("Missing recipe title");
  } else {
    scores.push(1.0);
  }

  if (draft.ingredients.length === 0) {
    scores.push(0);
    reasons.push("No ingredients found");
  }

  if (draft.steps.length === 0) {
    scores.push(0);
    reasons.push("No steps found");
  }

  const overallConfidence =
    scores.length > 0 ? scores.reduce((sum, score) => sum + score, 0) / scores.length : 0;

  const needsReview = overallConfidence < 0.6 || reasons.length > 0;

  return {
    overallConfidence,
    needsReview,
    reviewReasons: [...new Set(reasons)],
  };
}

/**
 * Detect method tags from ingredients and steps
 */
export function detectMethodTags(ingredients: string[], steps: string[]): string[] {
  const tags: Set<string> = new Set();
  const text = [...ingredients, ...steps].join(" ").toLowerCase();

  if (text.includes("crock pot") || text.includes("slow cooker") || text.includes("crockpot")) {
    tags.add("crock_pot");
  }
  if (text.includes("instant pot") || text.includes("pressure cooker")) {
    tags.add("instant_pot");
  }
  if (text.includes("sheet pan") || text.includes("baking sheet")) {
    tags.add("sheet_pan");
  }
  if (
    text.includes("grill") ||
    text.includes("grilling") ||
    text.includes("barbecue") ||
    text.includes("bbq")
  ) {
    tags.add("grill");
  }
  if (
    (text.includes("no cook") || text.includes("no-cook") || text.includes("no bake")) &&
    !text.includes("cooking") &&
    !text.includes("baking")
  ) {
    tags.add("no_cook");
  }
  if (
    text.includes("freezer friendly") ||
    text.includes("can be frozen") ||
    text.includes("freeze")
  ) {
    tags.add("freezer_friendly");
  }
  if (
    text.includes("make ahead") ||
    text.includes("make-ahead") ||
    text.includes("prepare ahead")
  ) {
    tags.add("make_ahead");
  }

  return Array.from(tags);
}

/**
 * Extract timers from step text
 */
export function extractTimers(text: string): Array<{ duration: number; label?: string }> {
  const timers: Array<{ duration: number; label?: string }> = [];

  const rangePattern = /(\d+)\s*(?:to|-)\s*(\d+)\s*(minute|min|hour|hr)s?/gi;
  const rangeMatches = text.matchAll(rangePattern);
  for (const match of rangeMatches) {
    const unit = match[3]?.toLowerCase();
    if (!unit) continue;

    const min = parseInt(match[1]!);
    const max = parseInt(match[2]!);
    let duration = (min + max) / 2;

    if (unit.startsWith("hour") || unit === "hr") {
      duration *= 60;
    }

    if (duration > 0) {
      timers.push({ duration: Math.round(duration) });
    }
  }

  const textWithoutRanges = text.replace(rangePattern, "");

  const singlePattern = /(\d+)\s*(minute|min|hour|hr)s?/gi;
  const singleMatches = textWithoutRanges.matchAll(singlePattern);
  for (const match of singleMatches) {
    const unit = match[2]?.toLowerCase();
    if (!unit) continue;

    let duration = parseInt(match[1]!);

    if (unit.startsWith("hour") || unit === "hr") {
      duration *= 60;
    }

    if (duration > 0) {
      timers.push({ duration });
    }
  }

  return timers;
}
