import { notFound, redirect } from "next/navigation";
import { CookbookService, PeopleService, RecipeService } from "@ovenlovin/core";
import { getDatabase } from "@ovenlovin/db";
import { RecipeDetail } from "@/components/kitchen/RecipeDetail";
import { getSessionContext } from "@/lib/session";

export default async function RecipeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const context = await getSessionContext().catch(() => null);
  if (!context?.householdId) redirect("/sign-in");

  const { id } = await params;
  const db = getDatabase();
  const recipe = await new RecipeService(db).getRecipeDetails(id);
  if (!recipe || recipe.householdId !== context.householdId) notFound();

  const cookbooks = await new CookbookService(db).listCookbooks(context.householdId, { limit: 50 });
  const peopleService = new PeopleService(db);
  const people = await peopleService.listPeopleByHousehold(context.householdId, { limit: 40 });
  const rules = await peopleService.getRulesForPeople(people.items.map((person) => person.id));

  return (
    <RecipeDetail recipe={recipe} cookbooks={cookbooks.items} people={people.items} rules={rules} />
  );
}
