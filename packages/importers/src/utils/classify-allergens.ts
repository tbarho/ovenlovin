import { matchIngredient } from "@ovenlovin/allergens";
import type { DraftAllergenHit, ParsedIngredient } from "../types/importer";

export type { DraftAllergenHit };

/** Map extracted ingredient lines through the shared allergen catalog. */
export function classifyDraftIngredients(ingredients: ParsedIngredient[]): DraftAllergenHit[] {
  const hits: DraftAllergenHit[] = [];
  const seen = new Set<string>();

  for (const ingredient of ingredients) {
    const text = ingredient.ingredient?.trim() || ingredient.rawText.trim();
    if (!text) continue;

    for (const mapping of matchIngredient(text)) {
      const key = `${text}::${mapping.allergenCode}::${mapping.relation}`;
      if (seen.has(key)) continue;
      seen.add(key);
      hits.push({
        ingredientText: text,
        allergenCode: mapping.allergenCode,
        allergenName: mapping.name,
        relation: mapping.relation,
      });
    }
  }

  return hits;
}
