import { redirect } from "next/navigation";
import { CookbookService, PeopleService, RecipeService } from "@ovenlovin/core";
import { getDatabase } from "@ovenlovin/db";
import { CookbookRecipes } from "@/components/kitchen/CookbookRecipes";
import { RecipesKitchen } from "@/components/kitchen/RecipesKitchen";
import { householdLovePeople, sortRecipesByLoves } from "@/lib/household-loves";
import { requireKitchenContext } from "@/lib/kitchen-session";

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
  const preferences = await peopleService.getPreferencesForPeople(
    people.items.map((person) => person.id),
    "love"
  );
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
    return (
      <CookbookRecipes
        cookbook={cookbook}
        recipes={sortRecipesByLoves(members.items, lovePeople)}
        catalog={catalog.items}
        booksByRecipe={booksByRecipe}
        lovePeople={lovePeople}
      />
    );
  }

  const [cards, uncategorized, all] = await Promise.all([
    cookbooks.listCookbookCards(householdId),
    recipes.listRecipes(householdId, { uncategorized: true, pagination: { limit: 40 } }),
    recipes.listRecipes(householdId, { pagination: { limit: 40 } }),
  ]);

  return (
    <RecipesKitchen
      cookbooks={cards}
      uncategorized={sortRecipesByLoves(uncategorized.items, lovePeople)}
      recipes={sortRecipesByLoves(all.items, lovePeople)}
      lovePeople={lovePeople}
    />
  );
}
