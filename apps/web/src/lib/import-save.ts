import type { RecipeDetails, RecipeImportDraft } from "@ovenlovin/core";
import { RecipeService, type PersistImportedDraftResult } from "@ovenlovin/core";
import { getDatabase } from "@ovenlovin/db";
import { demoSandbox } from "@ovenlovin/db/schema";
import { eq } from "drizzle-orm";
import { ConflictError } from "@/lib/api/errors";
import { recordSuccessfulDemoImport } from "@/lib/demo/enforce";
import { DEMO_IMPORT_LIMIT } from "@/lib/demo/fixture";
import { remainingImportsFromCount } from "@/lib/demo/limits";
import { isDemoModeEnabled } from "@/lib/demo/mode";

export type DemoImportQuota = {
  remainingImports: number;
  importLimit: number;
  importCount: number;
};

export function wantsPersist(save: unknown): boolean {
  return save === true || save === "true";
}

export function countsAsDemoImport(sourceType: string | undefined): boolean {
  return sourceType === "url" || sourceType === "photo" || sourceType === "paste";
}

export function importDuplicateDetail(
  match: PersistImportedDraftResult extends { match: infer M } ? M : string,
  title: string | null
): string {
  const named = title ? `"${title}"` : "a recipe";
  if (match === "photo") {
    return `This photo was already imported as ${named}. Open that recipe instead of importing again.`;
  }
  if (match === "photo_near") {
    return `A similar PNG photo was already imported as ${named}. Near-duplicate checks use a perceptual hash of PNG bytes only. Send allowDuplicate:true to save this recipe anyway.`;
  }
  if (match === "source_url") {
    return `This URL was already imported as ${named}. Open that recipe instead of importing again.`;
  }
  if (match === "in_flight") {
    return "This import is already in progress. Retry with the same Idempotency-Key.";
  }
  return `${named} was already imported. Open that recipe instead of importing again.`;
}

export function conflictFromImportResult(result: PersistImportedDraftResult): ConflictError {
  if (result.outcome === "in_flight") {
    return new ConflictError(importDuplicateDetail("in_flight", null), {
      code: "import_in_progress",
      match: result.match,
    });
  }
  if (result.outcome !== "existing") {
    return new ConflictError("This recipe was already imported.");
  }
  return new ConflictError(importDuplicateDetail(result.match, result.recipe.title), {
    code: result.match === "idempotency" ? "import_replay" : "import_duplicate",
    match: result.match,
    recipeId: result.recipe.id,
    title: result.recipe.title,
    recipeUrl: `/recipes/${result.recipe.id}`,
    ...(result.match === "photo_near"
      ? { possibleDuplicate: possibleDuplicateOf(result.recipe) }
      : {}),
  });
}

export function nearPhotoDuplicateConflict(recipe: { id: string; title: string }): ConflictError {
  return new ConflictError(importDuplicateDetail("photo_near", recipe.title), {
    code: "import_near_duplicate",
    match: "photo_near",
    recipeId: recipe.id,
    title: recipe.title,
    recipeUrl: `/recipes/${recipe.id}`,
    possibleDuplicate: possibleDuplicateOf(recipe),
  });
}

export async function demoImportQuota(householdId: string): Promise<DemoImportQuota | null> {
  if (!isDemoModeEnabled()) return null;
  const db = getDatabase();
  const [row] = await db
    .select()
    .from(demoSandbox)
    .where(eq(demoSandbox.householdId, householdId))
    .limit(1);
  if (!row || row.deletedAt) return null;
  return {
    importCount: row.importCount,
    importLimit: DEMO_IMPORT_LIMIT,
    remainingImports: remainingImportsFromCount(row.importCount),
  };
}

export function withDemoImportQuota<T extends object>(
  data: T,
  quota: DemoImportQuota | null
): T & Partial<DemoImportQuota> {
  if (!quota) return data;
  return { ...data, ...quota };
}

export async function saveImportedRecipe(
  draft: RecipeImportDraft,
  input: { householdId: string; createdBy: string; idempotencyKey?: string }
): Promise<{ result: PersistImportedDraftResult; quota: DemoImportQuota | null }> {
  const result = await new RecipeService(getDatabase()).persistImportedDraft(draft, input);
  if (result.outcome === "created" && countsAsDemoImport(draft.source.type)) {
    await recordSuccessfulDemoImport(input.householdId);
  }
  return { result, quota: await demoImportQuota(input.householdId) };
}

export type PossibleDuplicate = { recipeId: string; title: string };

export function possibleDuplicateOf(recipe: { id: string; title: string }): PossibleDuplicate {
  return { recipeId: recipe.id, title: recipe.title };
}

export function presentImportPreview(draft: RecipeImportDraft) {
  return {
    saved: false as const,
    preview: true as const,
    title: draft.title,
    description: draft.description,
    notes: draft.notes,
    servings: draft.servings,
    prepTimeMinutes: draft.prepTimeMinutes,
    cookTimeMinutes: draft.cookTimeMinutes,
    totalTimeMinutes: draft.totalTimeMinutes,
    cuisine: draft.cuisine,
    course: draft.course,
    ingredients: draft.ingredients,
    steps: draft.steps,
    images: draft.images ?? [],
    needsReview: Boolean(draft.needsReview),
    reviewReasons: draft.reviewReasons ?? [],
    uncertainFields: draft.uncertainFields ?? [],
    source: draft.source,
  };
}

export function isIdempotentReplay(result: PersistImportedDraftResult): boolean {
  return result.outcome === "existing" && result.match === "idempotency";
}

export function replayOrDuplicateUrlImport(collision: {
  recipe: RecipeDetails;
  match: "idempotency" | "source_url";
}): { kind: "replay"; recipe: RecipeDetails } | { kind: "duplicate"; recipe: RecipeDetails } {
  if (collision.match === "idempotency") return { kind: "replay", recipe: collision.recipe };
  return { kind: "duplicate", recipe: collision.recipe };
}

export function recipeFromPersist(result: PersistImportedDraftResult): RecipeDetails {
  if (result.outcome === "created") return result.recipe;
  if (result.outcome === "existing" && result.match === "idempotency") return result.recipe;
  throw conflictFromImportResult(result);
}
