"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { PersonLove } from "@ovenlovin/allergens";
import type { Cookbook, Person, PersonRule, RecipeDetails } from "@ovenlovin/core";
import { recipeMainImage } from "@ovenlovin/core/media";
import {
  clampServings,
  formatDurationMinutes,
  scaleIngredientDisplay,
} from "@ovenlovin/core/scaling";
import { loveHitsForRecipe } from "@/lib/household-loves";
import { whoCanEat } from "@/lib/who-can-eat";
import { KitchenToast } from "./KitchenToast";
import { LoveTags } from "./LoveTags";
import {
  CookbooksSheet,
  DetailsSheet,
  IngredientsSheet,
  PhotosSheet,
  StepsSheet,
} from "./RecipeEditSheets";
import { WhoCanEat } from "./WhoCanEat";

const EMPTY_LOVE_PEOPLE: PersonLove[] = [];

function sourceHost(url: string): string {
  try {
    return new URL(url).host.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export function RecipeDetail({
  recipe,
  cookbooks,
  people = [],
  rules = [],
  lovePeople = EMPTY_LOVE_PEOPLE,
  backHref = "/recipes",
  backLabel = "Recipes",
}: {
  recipe: RecipeDetails;
  cookbooks: Cookbook[];
  people?: Person[];
  rules?: PersonRule[];
  lovePeople?: PersonLove[];
  backHref?: string;
  backLabel?: string;
}) {
  const storedServings = recipe.servings && recipe.servings > 0 ? recipe.servings : 4;
  const [servings, setServings] = useState(storedServings);
  const [sheet, setSheet] = useState<
    null | "details" | "image" | "ingredients" | "steps" | "cookbook"
  >(null);
  const [toast, setToast] = useState<string | null>(null);
  const closeSheet = useCallback(() => setSheet(null), []);

  const mainImage = recipeMainImage(recipe.images);
  const sourceUrl = recipe.source?.canonicalUrl || recipe.source?.url || null;
  const checkIngredients = recipe.ingredients.map((ingredient) => ({
    id: ingredient.id,
    name: ingredient.rawText,
    substitutionNotes: ingredient.substitutionNotes,
  }));
  const eat = useMemo(
    () => whoCanEat({ people, rules, ingredients: checkIngredients }),
    [people, rules, recipe.ingredients]
  );
  const warningPersonIds = eat.people
    .filter((person) => person.mark !== "ok")
    .map((person) => person.personId);

  useEffect(() => {
    const raw = window.sessionStorage.getItem("ovenlovin.import-toast");
    if (!raw) return;
    window.sessionStorage.removeItem("ovenlovin.import-toast");
    try {
      const data = JSON.parse(raw) as { title?: string; servings?: number };
      const title = data.title || recipe.title;
      const count = data.servings || storedServings;
      setToast(`Imported ${title} · ${count} servings (guessed) · Add to a cookbook`);
    } catch {
      setToast(`Imported ${recipe.title} · Add to a cookbook`);
    }
  }, [recipe.title, storedServings]);

  const scaledIngredients = useMemo(
    () =>
      recipe.ingredients.map((ingredient) => ({
        id: ingredient.id,
        text: scaleIngredientDisplay(ingredient, recipe.servings ?? storedServings, servings),
      })),
    [recipe.ingredients, recipe.servings, servings, storedServings]
  );

  return (
    <>
      <div className="recipe-layout">
        <div className="recipe-layout-media">
          <div className="kitchen-head">
            <div>
              <Link href={backHref} className="back-link">
                ← {backLabel}
              </Link>
              <div className="section-head">
                <h1>{recipe.title}</h1>
                <button className="section-edit" type="button" onClick={() => setSheet("details")}>
                  Edit details
                </button>
              </div>
              <LoveTags
                hits={loveHitsForRecipe(
                  {
                    title: recipe.title,
                    description: recipe.description,
                    cuisine: recipe.cuisine,
                    course: recipe.course,
                    methodTags: recipe.methodTags,
                    ingredients: recipe.ingredients,
                  },
                  lovePeople
                )}
                warningPersonIds={warningPersonIds}
              />
              <div className="recipe-meta">
                {formatDurationMinutes(recipe.prepTimeMinutes) ? (
                  <span className="chip">Prep {formatDurationMinutes(recipe.prepTimeMinutes)}</span>
                ) : null}
                {formatDurationMinutes(recipe.cookTimeMinutes) ? (
                  <span className="chip">Cook {formatDurationMinutes(recipe.cookTimeMinutes)}</span>
                ) : null}
                {recipe.cuisine ? <span className="chip">{recipe.cuisine}</span> : null}
                {recipe.cookbooks.map((book) => (
                  <Link className="chip" key={book.id} href={`/recipes?cookbook=${book.id}`}>
                    {book.name}
                  </Link>
                ))}
                <button className="chip" type="button" onClick={() => setSheet("cookbook")}>
                  Cookbooks
                </button>
              </div>
              {sourceUrl ? (
                <a className="source-link" href={sourceUrl} target="_blank" rel="noreferrer">
                  View original on {sourceHost(sourceUrl)}
                </a>
              ) : null}
            </div>
          </div>

          <div className="recipe-hero">
            {mainImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={mainImage} alt={recipe.title} data-testid="recipe-main-image" />
            ) : (
              <div className="recipe-hero-fallback">Add a photo of this dish</div>
            )}
            <button
              className="section-edit recipe-hero-edit"
              type="button"
              onClick={() => setSheet("image")}
            >
              Edit image
            </button>
          </div>
        </div>

        <div className="recipe-layout-body">
          <WhoCanEat people={people} rules={rules} ingredients={checkIngredients} />

          <div className="servings-card">
            <header>
              <strong>Servings</strong>
              <span>{servings}</span>
            </header>
            <div className="servings-stepper">
              <button
                type="button"
                className="btn compact"
                aria-label="Fewer servings"
                onClick={() => setServings(clampServings(servings - 1))}
              >
                −
              </button>
              <input
                type="range"
                min={1}
                max={24}
                value={servings}
                aria-valuemin={1}
                aria-valuemax={24}
                aria-valuenow={servings}
                aria-label="Servings"
                onChange={(event) => setServings(clampServings(Number(event.target.value)))}
              />
              <button
                type="button"
                className="btn compact"
                aria-label="More servings"
                onClick={() => setServings(clampServings(servings + 1))}
              >
                +
              </button>
            </div>
            <p className="muted">
              1–24 servings. Scales from {recipe.servings ?? storedServings} stored servings. Units
              stay as written.
            </p>
          </div>

          {recipe.description ? <p className="recipe-lede">{recipe.description}</p> : null}

          {recipe.notes ? (
            <section>
              <h2>Notes</h2>
              <p className="recipe-lede">{recipe.notes}</p>
            </section>
          ) : null}

          <div className="recipe-view">
            <section>
              <div className="section-head">
                <h2>Ingredients</h2>
                <button
                  className="section-edit"
                  type="button"
                  onClick={() => setSheet("ingredients")}
                >
                  Edit ingredients
                </button>
              </div>
              {scaledIngredients.length === 0 ? (
                <p className="muted">No ingredients stored for this recipe.</p>
              ) : (
                <ul>
                  {scaledIngredients.map((ingredient) => (
                    <li key={ingredient.id}>{ingredient.text}</li>
                  ))}
                </ul>
              )}
            </section>
            <section>
              <div className="section-head">
                <h2>Steps</h2>
                <button className="section-edit" type="button" onClick={() => setSheet("steps")}>
                  Edit steps
                </button>
              </div>
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
        </div>
      </div>

      <DetailsSheet
        recipe={recipe}
        open={sheet === "details"}
        onClose={closeSheet}
        onSavedServings={setServings}
      />
      <PhotosSheet recipe={recipe} open={sheet === "image"} onClose={closeSheet} />
      <IngredientsSheet recipe={recipe} open={sheet === "ingredients"} onClose={closeSheet} />
      <StepsSheet recipe={recipe} open={sheet === "steps"} onClose={closeSheet} />
      <CookbooksSheet
        recipe={recipe}
        cookbooks={cookbooks}
        open={sheet === "cookbook"}
        onClose={closeSheet}
      />
      <KitchenToast message={toast} onDismiss={() => setToast(null)} />
    </>
  );
}
