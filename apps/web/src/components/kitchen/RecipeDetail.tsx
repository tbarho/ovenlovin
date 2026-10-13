"use client";

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import type { Cookbook, Person, PersonRule, RecipeDetails } from "@ovenlovin/core";
import { recipeGalleryImages, recipeMainImage } from "@ovenlovin/core/media";
import {
  clampServings,
  formatDurationMinutes,
  scaleIngredientDisplay,
} from "@ovenlovin/core/scaling";
import {
  CookbooksSheet,
  DetailsSheet,
  IngredientsSheet,
  PhotosSheet,
  StepsSheet,
} from "./RecipeEditSheets";
import { WhoCanEat } from "./WhoCanEat";

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
}: {
  recipe: RecipeDetails;
  cookbooks: Cookbook[];
  people?: Person[];
  rules?: PersonRule[];
}) {
  const storedServings = recipe.servings && recipe.servings > 0 ? recipe.servings : 4;
  const [servings, setServings] = useState(storedServings);
  const [sheet, setSheet] = useState<
    null | "details" | "image" | "ingredients" | "steps" | "cookbook"
  >(null);
  const closeSheet = useCallback(() => setSheet(null), []);

  const mainImage = recipeMainImage(recipe.images);
  const extraImages = recipeGalleryImages(recipe.images).slice(1);
  const sourceUrl = recipe.source?.canonicalUrl || recipe.source?.url || null;

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
      <div className="kitchen-head">
        <div>
          <Link href="/recipes" className="back-link">
            ← Recipes
          </Link>
          <h1>{recipe.title}</h1>
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
          <img src={mainImage} alt={recipe.title} />
        ) : (
          <div className="recipe-hero-fallback">Add a photo of this dish</div>
        )}
      </div>
      {extraImages.length > 0 ? (
        <div className="recipe-thumbs">
          {extraImages.map((src) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={src} src={src} alt="" />
          ))}
        </div>
      ) : null}

      <div className="recipe-actions">
        <button className="btn" type="button" onClick={() => setSheet("details")}>
          Edit details
        </button>
        <button className="btn" type="button" onClick={() => setSheet("image")}>
          Edit image
        </button>
        <button className="btn" type="button" onClick={() => setSheet("ingredients")}>
          Edit ingredients
        </button>
        <button className="btn" type="button" onClick={() => setSheet("steps")}>
          Edit steps
        </button>
        <button className="btn" type="button" onClick={() => setSheet("cookbook")}>
          Cookbooks
        </button>
      </div>

      <div className="servings-card">
        <header>
          <strong>Servings</strong>
          <span>{servings}</span>
        </header>
        <input
          type="range"
          min={1}
          max={24}
          value={servings}
          onChange={(event) => setServings(clampServings(Number(event.target.value)))}
        />
        <p className="muted">
          Scales from {recipe.servings ?? storedServings} stored servings. Units stay as written.
        </p>
      </div>

      {recipe.description ? <p>{recipe.description}</p> : null}

      <WhoCanEat
        people={people}
        rules={rules}
        ingredients={recipe.ingredients.map((ingredient) => ({
          id: ingredient.id,
          name: ingredient.rawText,
          substitutionNotes: ingredient.substitutionNotes,
        }))}
      />

      <div className="recipe-view">
        <section>
          <h2>Ingredients</h2>
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
    </>
  );
}
