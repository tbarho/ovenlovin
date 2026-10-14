import type { RecipeDraft } from "../types/importer";

const LOW_CONFIDENCE = 0.6;

export type FieldConfidence = "high" | "medium" | "low" | "illegible";

export function isLowFieldConfidence(value?: string): boolean {
  return value === "low" || value === "illegible";
}

/**
 * Named fields a reviewer should check after a low-confidence photo extract.
 */
export function listUncertainFields(
  draft: Pick<
    RecipeDraft,
    | "title"
    | "servings"
    | "prepTimeMinutes"
    | "cookTimeMinutes"
    | "totalTimeMinutes"
    | "ingredients"
    | "steps"
  >,
  extras?: {
    titleConfidence?: FieldConfidence;
    servingsConfidence?: FieldConfidence;
    timesConfidence?: FieldConfidence;
  }
): string[] {
  const fields: string[] = [];

  if (!draft.title.trim() || isLowFieldConfidence(extras?.titleConfidence)) {
    fields.push("title");
  }

  if (draft.servings == null || isLowFieldConfidence(extras?.servingsConfidence)) {
    fields.push("servings");
  }

  const hasTime =
    draft.prepTimeMinutes != null ||
    draft.cookTimeMinutes != null ||
    draft.totalTimeMinutes != null;
  if (!hasTime || isLowFieldConfidence(extras?.timesConfidence)) {
    fields.push("times");
  }

  draft.ingredients.forEach((ingredient, index) => {
    if (ingredient.confidence < LOW_CONFIDENCE) {
      const label = ingredient.ingredient?.trim() || ingredient.rawText.trim() || `#${index + 1}`;
      fields.push(`ingredient: ${label}`);
    }
  });

  draft.steps.forEach((step, index) => {
    if (step.confidence < LOW_CONFIDENCE) {
      fields.push(`step ${index + 1}`);
    }
  });

  return [...new Set(fields)];
}
