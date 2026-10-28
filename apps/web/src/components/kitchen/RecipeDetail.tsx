"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { PersonLove } from "@ovenlovin/allergens";
import type {
  Cookbook,
  HouseholdServingsSettings,
  Person,
  PersonRule,
  RecipeDetails,
} from "@ovenlovin/core";
import { recipeMainImage } from "@ovenlovin/core/media";
import {
  clampServings,
  cookForServingsLabel,
  defaultDisplayedServings,
  formatDurationMinutes,
  recipeYieldServings,
  scaleIngredientDisplay,
  servingsRangeMax,
} from "@ovenlovin/core/scaling";
import { api } from "@/lib/browser-api";
import { loveHitsForRecipe } from "@/lib/household-loves";
import { recipeDeleteConfirmCopy, writeRecipeDeleteToast } from "@/lib/recipe-delete";
import { recipeSafetyFromCheck } from "@/lib/recipe-card-safety";
import { whoCanEat } from "@/lib/who-can-eat";
import { ConfirmDialog } from "./ConfirmDialog";
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

/** "From *Book*, p. N" for recipes pulled from a cookbook PDF. */
export function bookAttribution(source: any): { title: string; page: number | null } | null {
  if (!source?.bookTitle) return null;
  const page = Number(source.rawExtractionJson?.bookPage ?? source.pageStart);
  return { title: source.bookTitle, page: Number.isFinite(page) && page > 0 ? page : null };
}

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
  plannedDates = [],
  servingsSettings = null,
  servingsOverride = null,
  fromPlan = false,
  backHref = "/recipes",
  backLabel = "Recipes",
}: {
  recipe: RecipeDetails;
  cookbooks: Cookbook[];
  people?: Person[];
  rules?: PersonRule[];
  lovePeople?: PersonLove[];
  plannedDates?: string[];
  servingsSettings?: HouseholdServingsSettings | null;
  servingsOverride?: number | null;
  fromPlan?: boolean;
  backHref?: string;
  backLabel?: string;
}) {
  const router = useRouter();
  const storedServings = recipeYieldServings(recipe.servings);
  const familySize = servingsSettings?.familySize ?? people.length;
  const servingsMode = servingsSettings?.mode ?? "family";
  const fixedServings = servingsSettings?.servings ?? null;
  const autoServings = defaultDisplayedServings({
    recipeServings: storedServings,
    familySize,
    mode: servingsMode,
    fixedServings,
  });
  const openedServings = servingsOverride ?? autoServings;
  const planServings = fromPlan ? servingsOverride : null;
  const servingsMax = servingsRangeMax(storedServings, openedServings);
  const [servings, setServings] = useState(openedServings);
  const [sheet, setSheet] = useState<
    null | "details" | "image" | "ingredients" | "steps" | "cookbook"
  >(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const closeSheet = useCallback(() => setSheet(null), []);
  const deleteCopy = recipeDeleteConfirmCopy(recipe.title, plannedDates);

  async function deleteRecipe() {
    setPendingDelete(true);
    setDeleteError(null);
    try {
      await api(`/api/v1/recipes/${recipe.id}`, { method: "DELETE" });
      setConfirmDelete(false);
      writeRecipeDeleteToast({ id: recipe.id, title: recipe.title });
      router.push("/recipes");
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Could not delete recipe");
    } finally {
      setPendingDelete(false);
    }
  }

  const mainImage = recipeMainImage(recipe.images);
  const sourceUrl = recipe.source?.canonicalUrl || recipe.source?.url || null;
  const fromBook = bookAttribution(recipe.source);
  const checkIngredients = recipe.ingredients.map((ingredient) => ({
    id: ingredient.id,
    name: ingredient.rawText,
    substitutionNotes: ingredient.substitutionNotes,
  }));
  const eat = useMemo(
    () => whoCanEat({ people, rules, ingredients: checkIngredients }),
    [people, rules, recipe.ingredients]
  );
  const safety = recipeSafetyFromCheck(eat);

  useEffect(() => {
    const raw = window.sessionStorage.getItem("ovenlovin.import-toast");
    if (!raw) return;
    window.sessionStorage.removeItem("ovenlovin.import-toast");
    try {
      const data = JSON.parse(raw) as { title?: string; servings?: number | null };
      const title = data.title || recipe.title;
      const count = data.servings && data.servings > 0 ? data.servings : null;
      setToast(
        `${count ? `Imported ${title} · ${count} servings (guessed)` : `Imported ${title} · servings unknown`} · Add to a cookbook`
      );
    } catch {
      setToast(`Imported ${recipe.title} · Add to a cookbook`);
    }
  }, [recipe.title, storedServings]);

  const scaledIngredients = useMemo(
    () =>
      recipe.ingredients.map((ingredient) => ({
        id: ingredient.id,
        text: scaleIngredientDisplay(
          ingredient,
          recipe.servings && recipe.servings > 0 ? recipe.servings : servings,
          servings
        ),
      })),
    [recipe.ingredients, recipe.servings, servings, storedServings]
  );
  const servingsLabel =
    planServings != null && servings === planServings && planServings !== storedServings
      ? `Scaled to ${planServings} for this week's plan`
      : cookForServingsLabel({
          cookFor: servings,
          recipeServings: storedServings,
        });
  function applyStoredServings(nextStored: number) {
    setServings(
      defaultDisplayedServings({
        recipeServings: nextStored,
        familySize,
        mode: servingsMode,
        fixedServings,
      })
    );
    setToast("Saved");
  }

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
                <button
                  className="section-edit"
                  type="button"
                  onClick={() => setConfirmDelete(true)}
                  disabled={pendingDelete}
                >
                  Delete recipe
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
                warningPersonIds={safety.warnPersonIds}
                blockPersonIds={safety.blockPersonIds}
                blockTitles={safety.blockTitles}
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
              {fromBook ? (
                <p className="book-attribution muted">
                  From <em>{fromBook.title}</em>
                  {fromBook.page ? `, p. ${fromBook.page}` : null}
                </p>
              ) : null}
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
                onClick={() => setServings(clampServings(servings - 1, 1, servingsMax))}
              >
                −
              </button>
              <input
                type="range"
                min={1}
                max={servingsMax}
                value={servings}
                aria-valuemin={1}
                aria-valuemax={servingsMax}
                aria-valuenow={servings}
                aria-label="Servings"
                onChange={(event) =>
                  setServings(clampServings(Number(event.target.value), 1, servingsMax))
                }
              />
              <button
                type="button"
                className="btn compact"
                aria-label="More servings"
                onClick={() => setServings(clampServings(servings + 1, 1, servingsMax))}
              >
                +
              </button>
            </div>
            <p className="muted">
              <span data-testid="scaled-servings-note">
                {servingsLabel}
                {servings !== storedServings ? (
                  <>
                    .{" "}
                    <button
                      type="button"
                      className="servings-reset"
                      onClick={() => setServings(storedServings)}
                    >
                      Reset to {storedServings}
                    </button>
                  </>
                ) : null}
              </span>
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
        onSavedServings={applyStoredServings}
      />
      <PhotosSheet recipe={recipe} open={sheet === "image"} onClose={closeSheet} />
      <IngredientsSheet recipe={recipe} open={sheet === "ingredients"} onClose={closeSheet} />
      <StepsSheet recipe={recipe} open={sheet === "steps"} onClose={closeSheet} />
      <CookbooksSheet
        recipe={recipe}
        cookbooks={cookbooks}
        open={sheet === "cookbook"}
        onClose={closeSheet}
        onSaved={() => setToast("Saved")}
      />
      <ConfirmDialog
        open={confirmDelete}
        title={deleteCopy.title}
        body={deleteCopy.body}
        confirmLabel="Delete recipe"
        pending={pendingDelete}
        danger
        error={deleteError}
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() => void deleteRecipe()}
      />
      <KitchenToast message={toast} onDismiss={() => setToast(null)} />
    </>
  );
}
