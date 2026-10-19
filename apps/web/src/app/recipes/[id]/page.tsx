import { notFound } from "next/navigation";
import {
  CookbookService,
  HouseholdService,
  PeopleService,
  PlanService,
  RecipeService,
} from "@ovenlovin/core";
import { getDatabase } from "@ovenlovin/db";
import { RecipeDetail } from "@/components/kitchen/RecipeDetail";
import { householdLovePeople } from "@/lib/household-loves";
import { requireKitchenContext } from "@/lib/kitchen-session";

export default async function RecipeDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ fromCookbook?: string }>;
}) {
  const context = await requireKitchenContext();

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
  const plannedDates = await new PlanService(db).listPlannedDatesForRecipe(context.householdId, id);
  const households = new HouseholdService(db);
  const household = await households.getHousehold(context.householdId);
  const servingsSettings = household
    ? households.servingsSettingsFor(household, people.items.length)
    : null;

  return (
    <RecipeDetail
      recipe={recipe}
      cookbooks={cookbooks.items}
      people={people.items}
      rules={rules}
      lovePeople={householdLovePeople(people.items, preferences)}
      plannedDates={plannedDates}
      servingsSettings={servingsSettings}
      backHref={fromBook ? `/recipes?cookbook=${fromBook.id}` : "/recipes"}
      backLabel={fromBook ? fromBook.name : "Recipes"}
    />
  );
}
