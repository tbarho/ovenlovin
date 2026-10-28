import { redirect } from "next/navigation";
import { CookbookService, PeopleService, RecipeService } from "@ovenlovin/core";
import { getDatabase } from "@ovenlovin/db";
import { CookbookRecipes } from "@/components/kitchen/CookbookRecipes";
import { RecipesKitchen } from "@/components/kitchen/RecipesKitchen";
import { householdLovePeople, sortRecipesByLoves } from "@/lib/household-loves";
import { demoImportQuota } from "@/lib/import-save";
import { listBookImportTiles } from "@/lib/book-import-view";
import { isBooksEnabled, jobQueue } from "@/lib/jobs";
import { requireKitchenContext } from "@/lib/kitchen-session";
import { loadRecipeSafetyById } from "@/lib/load-recipe-safety";

export default async function RecipesPage({
  searchParams,
}: {
  searchParams: Promise<{ cookbook?: string }>;
}) {
  const context = await requireKitchenContext();
  const householdId = context.householdId;
  const { cookbook: cookbookId } = await searchParams;

  const db = getDatabase();
  const recipes = new RecipeService(db);
  const cookbooks = new CookbookService(db);
  const peopleService = new PeopleService(db);
  const people = await peopleService.listPeopleByHousehold(householdId, { limit: 40 });
  const personIds = people.items.map((person) => person.id);
  const [preferences, rules] = await Promise.all([
    peopleService.getPreferencesForPeople(personIds, "love"),
    peopleService.getRulesForPeople(personIds),
  ]);
  const lovePeople = householdLovePeople(people.items, preferences);

  if (cookbookId) {
    const cookbook = await cookbooks.getCookbook(cookbookId);
    if (!cookbook || cookbook.householdId !== householdId) redirect("/recipes");
    const [members, catalog, booksByRecipe] = await Promise.all([
      recipes.listRecipes(householdId, {
        cookbookId,
        pagination: { limit: 80 },
      }),
      recipes.listRecipes(householdId, { pagination: { limit: 100 } }),
      cookbooks.listRecipeCookbookNames(householdId),
    ]);
    const safetyByRecipe = await loadRecipeSafetyById(
      members.items.map((recipe) => recipe.id),
      people.items,
      rules
    );
    return (
      <CookbookRecipes
        cookbook={cookbook}
        recipes={sortRecipesByLoves(members.items, lovePeople)}
        catalog={catalog.items}
        booksByRecipe={booksByRecipe}
        lovePeople={lovePeople}
        safetyByRecipe={safetyByRecipe}
      />
    );
  }

  const booksEnabled = isBooksEnabled();
  const [cards, uncategorized, all, importQuota, bookImports] = await Promise.all([
    cookbooks.listCookbookCards(householdId),
    recipes.listRecipes(householdId, { uncategorized: true, pagination: { limit: 40 } }),
    recipes.listRecipes(householdId, { pagination: { limit: 40 } }),
    demoImportQuota(householdId),
    booksEnabled ? listBookImportTiles(jobQueue(), householdId) : [],
  ]);

  const safetyByRecipe = await loadRecipeSafetyById(
    all.items.map((recipe) => recipe.id),
    people.items,
    rules
  );

  return (
    <RecipesKitchen
      cookbooks={cards}
      uncategorized={sortRecipesByLoves(uncategorized.items, lovePeople)}
      recipes={sortRecipesByLoves(all.items, lovePeople)}
      lovePeople={lovePeople}
      safetyByRecipe={safetyByRecipe}
      remainingImports={importQuota?.remainingImports}
      importLimit={importQuota?.importLimit}
      booksEnabled={booksEnabled}
      bookImports={bookImports}
    />
  );
}
