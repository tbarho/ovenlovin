"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { PersonLove } from "@ovenlovin/allergens";
import type { CookbookCard, Recipe } from "@ovenlovin/core";
import { recipeMainImage } from "@ovenlovin/core/media";
import { api } from "@/lib/browser-api";
import { filterRecipesByQuery } from "@/lib/cookbook-recipes";
import { recipeCardMeta } from "@/lib/recipe-card-meta";
import { EMPTY_RECIPE_SAFETY, type RecipeSafetySummary } from "@/lib/recipe-card-safety";
import { readRecipeDeleteToast, type RecipeDeleteToast } from "@/lib/recipe-delete";
import { ImportRecipeForm } from "./ImportRecipeForm";
import { BottomSheet } from "./BottomSheet";
import { KitchenToast } from "./KitchenToast";
import { KitchenTour } from "./KitchenTour";
import { RecipeCardSafety } from "./RecipeCardSafety";
import type { BookImportTile } from "@/lib/book-import-view";

const EMPTY_LOVE_PEOPLE: PersonLove[] = [];
const NEW_RECIPE_HIGHLIGHT_MS = 2400;

function RecipeThumb({ recipe }: { recipe: Recipe }) {
  const image = recipeMainImage(recipe.images);
  return image ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={image} alt="" />
  ) : (
    <div className="thumb-fallback">{recipe.title.slice(0, 1)}</div>
  );
}

function CookbookMosaic({ cookbook }: { cookbook: CookbookCard }) {
  const tiles = [...cookbook.previewImages];
  while (tiles.length < 4) tiles.push("");
  return (
    <div className="mosaic" aria-hidden="true">
      {tiles.slice(0, 4).map((src, index) =>
        src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={`${src}-${index}`} src={src} alt="" />
        ) : (
          <span key={`empty-${index}`}>{index === 0 ? cookbook.name.slice(0, 1) : ""}</span>
        )
      )}
    </div>
  );
}

function NewCookbookSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function createCookbook(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      await api("/api/v1/cookbooks", {
        method: "POST",
        body: JSON.stringify({ name }),
      });
      setName("");
      onClose();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create cookbook");
    } finally {
      setPending(false);
    }
  }

  return (
    <BottomSheet open={open} title="New cookbook" onClose={onClose}>
      <form className="form-card" style={{ margin: 0 }} onSubmit={createCookbook}>
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Sunday soup, snacks…"
          required
        />
        {error ? <p className="muted">{error}</p> : null}
        <button className="btn primary" type="submit" disabled={pending || !name.trim()}>
          {pending ? "Creating…" : "Create cookbook"}
        </button>
      </form>
    </BottomSheet>
  );
}

export function RecipesKitchen({
  cookbooks,
  uncategorized,
  recipes,
  lovePeople = EMPTY_LOVE_PEOPLE,
  safetyByRecipe = {},
  remainingImports,
  importLimit,
  booksEnabled = false,
  bookImports = [],
  instagramCredits = {},
  cookbookNames = {},
}: {
  cookbooks: CookbookCard[];
  uncategorized: Recipe[];
  recipes: Recipe[];
  lovePeople?: PersonLove[];
  safetyByRecipe?: Record<string, RecipeSafetySummary>;
  remainingImports?: number;
  importLimit?: number;
  booksEnabled?: boolean;
  bookImports?: BookImportTile[];
  instagramCredits?: Record<string, { handle: string; url: string }>;
  cookbookNames?: Record<string, string[]>;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [scope, setScope] = useState<"unfiled" | "all">("all");
  const [deleted, setDeleted] = useState<RecipeDeleteToast | null>(null);
  // The recipe just imported. `sheetClosed` flips once the import sheet has
  // closed and restored focus, so moving focus to the card cannot lose that race.
  const [newRecipe, setNewRecipe] = useState<{ id: string; sheetClosed: boolean } | null>(null);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const close = useCallback(() => setOpen(false), []);
  const emptyKitchen = recipes.length === 0;
  const showImport = emptyKitchen || importOpen;

  useEffect(() => {
    setDeleted(readRecipeDeleteToast());
  }, []);

  async function undoDelete(recipe: RecipeDeleteToast) {
    setDeleted(null);
    try {
      await api(`/api/v1/recipes/${recipe.id}/restore`, { method: "POST" });
      router.refresh();
    } catch {
      setDeleted(recipe);
    }
  }

  function recipeLine(recipe: Recipe): string {
    const credit = instagramCredits[recipe.id];
    if (!credit) return recipeCardMeta(recipe);
    const book = cookbookNames[recipe.id]?.[0];
    return book
      ? `From ${credit.handle} on Instagram · ${book}`
      : `From ${credit.handle} on Instagram`;
  }

  const pool = scope === "all" || query.trim() || cookbooks.length === 0 ? recipes : uncategorized;
  const listed = useMemo(() => filterRecipesByQuery(pool, query), [pool, query]);
  const finishImport = useCallback((recipeId: string | null) => {
    setNewRecipe(recipeId ? { id: recipeId, sheetClosed: false } : null);
    setImportOpen(false);
  }, []);
  const importSheetClosed = useCallback(() => {
    setNewRecipe((current) => (current ? { ...current, sheetClosed: true } : current));
  }, []);

  // After an import, bring the new card into view once the sheet is gone and the
  // refreshed list has it. Waits a frame so nothing else in the close can take focus back.
  useEffect(() => {
    if (!newRecipe?.sheetClosed || !listed.some((recipe) => recipe.id === newRecipe.id)) return;
    const recipeId = newRecipe.id;
    const frame = window.requestAnimationFrame(() => {
      const card = document.querySelector<HTMLElement>(`[data-recipe-id="${recipeId}"]`);
      if (!card) return;
      card.scrollIntoView?.({ block: "center" });
      card.focus({ preventScroll: true });
      setHighlightId(recipeId);
      setNewRecipe(null);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [newRecipe, listed]);

  useEffect(() => {
    if (!highlightId) return;
    const timer = window.setTimeout(() => setHighlightId(null), NEW_RECIPE_HIGHLIGHT_MS);
    return () => window.clearTimeout(timer);
  }, [highlightId]);

  const sectionLabel =
    query.trim() || scope === "all" || cookbooks.length === 0
      ? "All recipes"
      : "Recipes not in a cookbook yet";

  return (
    <>
      {emptyKitchen ? <KitchenTour /> : null}
      <div className="kitchen-head recipes-index-head">
        <div>
          <h1>Recipes</h1>
          <p className="muted">
            {emptyKitchen
              ? "Import a recipe. Add it to a cookbook later if you want it on a shelf."
              : "Search your recipes, or add another."}
          </p>
        </div>
        <div className="recipe-actions" style={{ margin: 0 }}>
          <button
            className="btn primary"
            type="button"
            aria-expanded={showImport}
            aria-controls="add-recipe-panel"
            onClick={() => {
              if (!emptyKitchen) setImportOpen((current) => !current);
            }}
          >
            + Import
          </button>
          <button className="btn" type="button" onClick={() => setOpen(true)}>
            New cookbook
          </button>
        </div>
      </div>
      {showImport && emptyKitchen ? (
        <div id="add-recipe-panel">
          <ImportRecipeForm
            remainingImports={remainingImports}
            importLimit={importLimit}
            booksEnabled={booksEnabled}
            cookbooks={cookbooks.map((cookbook) => ({ id: cookbook.id, name: cookbook.name }))}
          />
        </div>
      ) : null}

      {emptyKitchen ? null : (
        <div className="recipe-browse">
          <label className="field">
            <span className="field-label">Search recipes</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Pesto, soup, cookies…"
            />
          </label>
          {cookbooks.length > 0 ? (
            <div className="tabs recipe-scope" role="tablist" aria-label="Recipe shelf">
              <button
                type="button"
                className="tab"
                role="tab"
                aria-selected={scope === "unfiled"}
                onClick={() => setScope("unfiled")}
              >
                Unfiled
              </button>
              <button
                type="button"
                className="tab"
                role="tab"
                aria-selected={scope === "all"}
                onClick={() => setScope("all")}
              >
                All recipes
              </button>
            </div>
          ) : null}
        </div>
      )}

      {cookbooks.length > 0 || bookImports.length > 0 ? (
        <>
          <p className="section-label">Cookbooks</p>
          <div className="cookbook-grid cookbook-shelf">
            {bookImports.map((book) => (
              <Link
                className="cookbook-card book-import-card"
                key={book.jobId}
                href={`/recipes/books/${book.jobId}`}
              >
                <div className="mosaic" aria-hidden="true">
                  <span>{book.name.slice(0, 1)}</span>
                  <span />
                  <span />
                  <span />
                </div>
                <div>
                  <h2>{book.name}</h2>
                  <p className="muted">{book.line}</p>
                </div>
              </Link>
            ))}
            {cookbooks.map((cookbook) => (
              <Link
                className="cookbook-card"
                key={cookbook.id}
                href={`/recipes?cookbook=${cookbook.id}`}
              >
                <CookbookMosaic cookbook={cookbook} />
                <div>
                  <h2>{cookbook.name}</h2>
                  <p className="muted">
                    {cookbook.recipeCount} {cookbook.recipeCount === 1 ? "recipe" : "recipes"}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </>
      ) : null}

      {listed.length === 0 ? (
        emptyKitchen && !query.trim() ? null : (
          <p className="empty-note">
            {query.trim()
              ? "No recipes match that search."
              : cookbooks.length > 0
                ? "Recipes not in a cookbook yet will show up here. Import another, or open a book above."
                : "No recipes yet. Import one above to start cooking."}
          </p>
        )
      ) : (
        <>
          <p className="section-label">{sectionLabel}</p>
          <div className="recipe-grid">
            {listed.map((recipe) => (
              <Link
                className={
                  recipe.id === highlightId ? "recipe-card recipe-card-new" : "recipe-card"
                }
                key={recipe.id}
                href={`/recipes/${recipe.id}`}
                data-recipe-id={recipe.id}
              >
                <RecipeThumb recipe={recipe} />
                <div className="card-copy">
                  <h2>{recipe.title}</h2>
                  <RecipeCardSafety
                    recipe={recipe}
                    lovePeople={lovePeople}
                    safety={safetyByRecipe[recipe.id] ?? EMPTY_RECIPE_SAFETY}
                  />
                  <p className="muted">{recipeLine(recipe)}</p>
                </div>
              </Link>
            ))}
          </div>
        </>
      )}

      <BottomSheet
        open={!emptyKitchen && importOpen}
        title="Import a recipe"
        id="add-recipe-panel"
        onClose={() => setImportOpen(false)}
        onClosed={importSheetClosed}
      >
        <ImportRecipeForm
          showHeading={false}
          remainingImports={remainingImports}
          importLimit={importLimit}
          booksEnabled={booksEnabled}
          cookbooks={cookbooks.map((cookbook) => ({ id: cookbook.id, name: cookbook.name }))}
          onDone={finishImport}
        />
      </BottomSheet>
      <NewCookbookSheet open={open} onClose={close} />
      <KitchenToast
        message={deleted ? `Deleted ${deleted.title}` : null}
        onUndo={deleted ? () => void undoDelete(deleted) : undefined}
        onDismiss={() => setDeleted(null)}
      />
    </>
  );
}
