import { paginate, readBookSettings } from "@ovenlovin/core/book";
import { CookbookService, RecipeService } from "@ovenlovin/core";
import { getDatabase } from "@ovenlovin/db";
import { recipeIngredientGroup } from "@ovenlovin/db/schema";
import { and, inArray, isNull } from "drizzle-orm";

/** One page of the laid-out book, exactly as `paginate` returns it. */
export type ReaderPage = Record<string, any>;

export type ReaderBook = {
  id: string;
  title: string;
  subtitle: string | null;
  pages: ReaderPage[];
};

export type ReaderDeps = {
  cookbooks?: Pick<CookbookService, "getCookbook" | "listRecipeIds">;
  recipes?: Pick<RecipeService, "getRecipeDetails">;
  groupNames?: (recipeIds: string[]) => Promise<Record<string, string>>;
};

/** Ingredient group id → name for the given recipes, in one query. */
function groupNamesFrom(db: any) {
  return async (recipeIds: string[]) => {
    if (!recipeIds.length) return {};
    const rows = await db
      .select({ id: recipeIngredientGroup.id, name: recipeIngredientGroup.name })
      .from(recipeIngredientGroup)
      .where(
        and(
          inArray(recipeIngredientGroup.recipeId, recipeIds),
          isNull(recipeIngredientGroup.deletedAt)
        )
      );
    return rows.reduce((memo: Record<string, string>, row: any) => {
      if (row.name) memo[row.id] = row.name;
      return memo;
    }, {});
  };
}

/** Recipe details to the cookbook shape `paginate` reads. Pure, for tests. */
export function readerRecipe(details: any, groupNames: Record<string, string> = {}) {
  return {
    id: details.id,
    title: details.title,
    description: details.description ?? null,
    familyStory: details.familyStory ?? null,
    course: details.course ?? null,
    servings: details.servings ?? null,
    yieldQuantity: details.yieldQuantity ?? null,
    yieldUnit: details.yieldUnit ?? null,
    prepTimeMinutes: details.prepTimeMinutes ?? null,
    cookTimeMinutes: details.cookTimeMinutes ?? null,
    totalTimeMinutes: details.totalTimeMinutes ?? null,
    images: details.images ?? [],
    isFamilyRecipe: details.isFamilyRecipe ?? false,
    sourcePhotos: details.sourcePhotos ?? [],
    ingredients: (details.ingredients ?? []).map((item: any) => ({
      rawText: item.rawText,
      name: item.name ?? null,
      group: (item.groupId && groupNames[item.groupId]) || null,
    })),
    steps: (details.steps ?? []).map((step: any) => ({ text: step.text })),
  };
}

/** The cookbook laid out as a book, in book order. Null unless it exists in this household. */
export async function loadReaderBook(
  cookbookId: string,
  householdId: string,
  deps: ReaderDeps = {}
): Promise<ReaderBook | null> {
  const db = deps.cookbooks && deps.recipes && deps.groupNames ? null : getDatabase();
  const cookbooks = deps.cookbooks ?? new CookbookService(db!);
  const recipes = deps.recipes ?? new RecipeService(db!);
  const groupNames = deps.groupNames ?? groupNamesFrom(db);

  const cookbook = await cookbooks.getCookbook(cookbookId);
  if (!cookbook || cookbook.householdId !== householdId) return null;

  const ids = await cookbooks.listRecipeIds(cookbookId);
  const [details, names] = await Promise.all([
    Promise.all(ids.map((id) => recipes.getRecipeDetails(id))),
    groupNames(ids),
  ]);
  const settings = readBookSettings(cookbook.bookSettings);
  const pages = paginate(
    {
      name: cookbook.name,
      recipes: details.filter(Boolean).map((item) => readerRecipe(item, names)),
    },
    settings
  );

  return {
    id: cookbook.id,
    title: settings.title?.trim() || cookbook.name,
    subtitle: settings.subtitle?.trim() || null,
    pages,
  };
}
