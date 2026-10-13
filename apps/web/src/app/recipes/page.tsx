import { redirect } from "next/navigation";
import { CookbookService, RecipeService } from "@ovenlovin/core";
import { getDatabase } from "@ovenlovin/db";
import { CookbookRecipes } from "@/components/kitchen/CookbookRecipes";
import { RecipesKitchen } from "@/components/kitchen/RecipesKitchen";
import { getSessionContext } from "@/lib/session";

export default async function RecipesPage({
  searchParams,
}: {
  searchParams: Promise<{ cookbook?: string }>;
}) {
  const context = await getSessionContext().catch(() => null);
  if (!context?.householdId) redirect("/sign-in");
  const householdId = context.householdId;
  const { cookbook: cookbookId } = await searchParams;

  const db = getDatabase();
  const recipes = new RecipeService(db);
  const cookbooks = new CookbookService(db);

  if (cookbookId) {
    const cookbook = await cookbooks.getCookbook(cookbookId);
    if (!cookbook || cookbook.householdId !== householdId) redirect("/recipes");
    const members = await recipes.listRecipes(householdId, {
      cookbookId,
      pagination: { limit: 80 },
    });
    return <CookbookRecipes cookbook={cookbook} recipes={members.items} />;
  }

  const [cards, uncategorized, all] = await Promise.all([
    cookbooks.listCookbookCards(householdId),
    recipes.listRecipes(householdId, { uncategorized: true, pagination: { limit: 40 } }),
    recipes.listRecipes(householdId, { pagination: { limit: 40 } }),
  ]);

  return (
    <RecipesKitchen cookbooks={cards} uncategorized={uncategorized.items} recipes={all.items} />
  );
}
