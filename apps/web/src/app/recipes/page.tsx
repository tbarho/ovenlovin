import Link from "next/link";
import { redirect } from "next/navigation";
import { RecipeService } from "@ovenlovin/core";
import { getDatabase } from "@ovenlovin/db";
import { ImportRecipeForm } from "@/components/kitchen/ImportRecipeForm";
import { getSessionContext } from "@/lib/session";

export default async function RecipesPage() {
  const context = await getSessionContext().catch(() => null);
  if (!context?.householdId) redirect("/sign-in");
  const householdId = context.householdId;

  const recipes = await new RecipeService(getDatabase()).listRecipes(householdId, {
    pagination: { limit: 40 },
  });

  return (
    <>
      <div className="kitchen-head">
        <div>
          <p className="badge">
            <i />
            Kitchen
          </p>
          <h1>Recipes</h1>
          <p className="muted">
            Import from a URL or paste. Your household was created with this sign-in.
          </p>
        </div>
        <Link className="btn" href="/people">
          People and rules
        </Link>
      </div>
      <ImportRecipeForm />
      {recipes.items.length === 0 ? (
        <p className="empty-note">No recipes yet. Import one above to start cooking.</p>
      ) : (
        <div className="recipe-grid">
          {recipes.items.map((recipe) => (
            <Link className="recipe-card" key={recipe.id} href={`/recipes/${recipe.id}`}>
              <h2>{recipe.title}</h2>
              <p className="muted">
                {recipe.cuisine || recipe.course || recipe.status}
                {recipe.totalTimeMinutes ? ` · ${recipe.totalTimeMinutes} min` : ""}
              </p>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
