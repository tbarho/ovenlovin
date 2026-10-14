import { createPhotoImporter } from "./importers/photo";
import type { ImporterConfig, PhotoImportInput, RecipeDraft } from "./types/importer";
import { classifyDraftIngredients, type DraftAllergenHit } from "./utils/classify-allergens";
import { listUncertainFields } from "./utils/uncertain-fields";

export type PhotoImportResult = {
  draft: RecipeDraft;
  uncertainFields: string[];
  allergenClassifications: DraftAllergenHit[];
};

/** Extract + structure a photo recipe, then classify allergens and list uncertain fields. */
export async function runPhotoImport(
  input: PhotoImportInput,
  config: ImporterConfig = {}
): Promise<PhotoImportResult> {
  const importer = createPhotoImporter(config);
  const raw = await importer.extract(input);
  const draft = await importer.toDraft(raw);
  const uncertainFields = draft.uncertainFields ?? listUncertainFields(draft);
  const allergenClassifications =
    draft.allergenClassifications ?? classifyDraftIngredients(draft.ingredients);

  return {
    draft: { ...draft, uncertainFields, allergenClassifications },
    uncertainFields,
    allergenClassifications,
  };
}
