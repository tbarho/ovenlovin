import type { RecipeImportDraft } from "../schemas/recipes";

/** Deterministic paste fallback when AI Gateway is off (including public demo). */
export function draftFromPlainText(text: string): RecipeImportDraft {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const title = lines[0] ?? "Untitled recipe";
  const rest = lines.slice(1);
  const ingredientStart = rest.findIndex((line) => /ingredient/i.test(line));
  const stepStart = rest.findIndex((line) => /step|instruction|method|direction/i.test(line));

  let ingredientLines: string[] = [];
  let stepLines: string[] = [];

  if (ingredientStart >= 0 && stepStart > ingredientStart) {
    ingredientLines = rest.slice(ingredientStart + 1, stepStart);
    stepLines = rest.slice(stepStart + 1);
  } else {
    ingredientLines = rest.filter((line) => line.length < 80);
    stepLines = rest.filter((line) => line.length >= 80);
    if (stepLines.length === 0) {
      stepLines = rest.slice(Math.ceil(rest.length / 2));
      ingredientLines = rest.slice(0, Math.ceil(rest.length / 2));
    }
  }

  return {
    title,
    description: rest[0] && rest[0] !== title ? rest[0] : undefined,
    ingredients: ingredientLines.map((rawText) => ({ rawText, confidence: 0.5 })),
    steps: stepLines.map((stepText, order) => ({ text: stepText, order })),
    source: {
      type: "paste",
      importerName: "plain-paste",
      importerVersion: "0.1.0",
      rawExtractionJson: { text },
    },
    needsReview: true,
  };
}
