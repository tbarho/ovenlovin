import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { RecipeService } from "@ovenlovin/core";
import { getDatabase } from "@ovenlovin/db";
import { getSessionContext } from "@/lib/session";

export default async function RecipeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  try {
    await getSessionContext();
  } catch {
    redirect("/sign-in");
  }

  const { id } = await params;
  const recipe = await new RecipeService(getDatabase()).getRecipeDetails(id);
  if (!recipe) notFound();

  return (
    <>
      <div className="kitchen-head">
        <div>
          <Link href="/recipes" className="muted">
            ← Recipes
          </Link>
          <h1>{recipe.title}</h1>
          <p className="muted">
            {[recipe.cuisine, recipe.course, recipe.servings ? `${recipe.servings} servings` : null]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
      </div>
      {recipe.description ? <p>{recipe.description}</p> : null}
      <div className="recipe-view">
        <section>
          <h2>Ingredients</h2>
          {recipe.ingredients.length === 0 ? (
            <p className="muted">No ingredients stored for this recipe.</p>
          ) : (
            <ul>
              {recipe.ingredients.map((ingredient) => (
                <li key={ingredient.id}>{ingredient.rawText}</li>
              ))}
            </ul>
          )}
        </section>
        <section>
          <h2>Steps</h2>
          {recipe.steps.length === 0 ? (
            <p className="muted">No steps stored for this recipe.</p>
          ) : (
            <ol>
              {recipe.steps.map((step) => (
                <li key={step.id}>{step.text}</li>
              ))}
            </ol>
          )}
        </section>
      </div>
    </>
  );
}
