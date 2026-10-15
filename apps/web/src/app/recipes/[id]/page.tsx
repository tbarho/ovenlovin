import { notFound, redirect } from "next/navigation";
import { CookbookService, PeopleService, RecipeService } from "@ovenlovin/core";
import { getDatabase } from "@ovenlovin/db";
import { RecipeDetail } from "@/components/kitchen/RecipeDetail";
import { householdLovePeople } from "@/lib/household-loves";
import { getSessionContext } from "@/lib/session";

export default async function RecipeDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ fromCookbook?: string }>;
}) {
  const context = await getSessionContext().catch(() => null);
  if (!context?.householdId) redirect("/sign-in");

  const { id } = await params;
  const { fromCookbook } = await searchParams;
  const db = getDatabase();
  const recipe = await new RecipeService(db).getRecipeDetails(id);
  if (!recipe || recipe.householdId !== context.householdId) notFound();

  const cookbookService = new CookbookService(db);
  const cookbooks = await cookbookService.listCookbooks(context.householdId, { limit: 50 });
  const fromBook = fromCookbook ? cookbooks.items.find((book) => book.id === fromCookbook) : null;
  const peopleService = new PeopleService(db);
  const people = await peopleService.listPeopleByHousehold(context.householdId, { limit: 40 });
  const rules = await peopleService.getRulesForPeople(people.items.map((person) => person.id));
  const preferences = await peopleService.getPreferencesForPeople(
    people.items.map((person) => person.id),
    "love"
  );

  return (
    <RecipeDetail
      recipe={recipe}
      cookbooks={cookbooks.items}
      people={people.items}
      rules={rules}
      lovePeople={householdLovePeople(people.items, preferences)}
      backHref={fromBook ? `/recipes?cookbook=${fromBook.id}` : "/recipes"}
      backLabel={fromBook ? fromBook.name : "Recipes"}
    />
  );
}
