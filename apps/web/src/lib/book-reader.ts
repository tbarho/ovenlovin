import { paginate, readBookSettings } from "@ovenlovin/core/book";
import { CookbookService, RecipeService } from "@ovenlovin/core";
import { getDatabase } from "@ovenlovin/db";

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
};

/** Recipe details to the cookbook shape `paginate` reads. Pure, for tests. */
export function readerRecipe(details: any) {
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
      group: null,
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
  const db = deps.cookbooks && deps.recipes ? null : getDatabase();
  const cookbooks = deps.cookbooks ?? new CookbookService(db!);
  const recipes = deps.recipes ?? new RecipeService(db!);

  const cookbook = await cookbooks.getCookbook(cookbookId);
  if (!cookbook || cookbook.householdId !== householdId) return null;

  const ids = await cookbooks.listRecipeIds(cookbookId);
  const details = await Promise.all(ids.map((id) => recipes.getRecipeDetails(id)));
  const settings = readBookSettings(cookbook.bookSettings);
  const pages = paginate(
    { name: cookbook.name, recipes: details.filter(Boolean).map(readerRecipe) },
    settings
  );

  return {
    id: cookbook.id,
    title: settings.title?.trim() || cookbook.name,
    subtitle: settings.subtitle?.trim() || null,
    pages,
  };
}
