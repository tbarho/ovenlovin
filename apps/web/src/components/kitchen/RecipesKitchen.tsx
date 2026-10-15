"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { PersonLove } from "@ovenlovin/allergens";
import type { CookbookCard, Recipe } from "@ovenlovin/core";
import { recipeMainImage } from "@ovenlovin/core/media";
import { api } from "@/lib/browser-api";
import { filterRecipesByQuery } from "@/lib/cookbook-recipes";
import { loveHitsForRecipe } from "@/lib/household-loves";
import { recipeCardMeta } from "@/lib/recipe-card-meta";
import { readRecipeDeleteToast, type RecipeDeleteToast } from "@/lib/recipe-delete";
import { ImportRecipeForm } from "./ImportRecipeForm";
import { BottomSheet } from "./BottomSheet";
import { KitchenToast } from "./KitchenToast";
import { KitchenTour } from "./KitchenTour";
import { LoveTags } from "./LoveTags";

const EMPTY_LOVE_PEOPLE: PersonLove[] = [];

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
}: {
  cookbooks: CookbookCard[];
  uncategorized: Recipe[];
  recipes: Recipe[];
  lovePeople?: PersonLove[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [scope, setScope] = useState<"unfiled" | "all">(cookbooks.length > 0 ? "unfiled" : "all");
  const [deleted, setDeleted] = useState<RecipeDeleteToast | null>(null);
  const close = useCallback(() => setOpen(false), []);

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

  const pool = scope === "all" || query.trim() || cookbooks.length === 0 ? recipes : uncategorized;
  const listed = useMemo(() => filterRecipesByQuery(pool, query), [pool, query]);
  const sectionLabel =
    query.trim() || scope === "all" || cookbooks.length === 0
      ? "All recipes"
      : "Recipes not in a cookbook yet";

  return (
    <>
      <div className="kitchen-head">
        <div>
          <h1>Recipes</h1>
          <p className="muted">
            Import a recipe. Add it to a cookbook later if you want it on a shelf.
          </p>
        </div>
        <div className="recipe-actions" style={{ margin: 0 }}>
          <button className="btn" type="button" onClick={() => setOpen(true)}>
            New cookbook
          </button>
        </div>
      </div>
      <KitchenTour />
      <ImportRecipeForm />

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

      {cookbooks.length > 0 ? (
        <>
          <p className="section-label">Cookbooks</p>
          <div className="cookbook-grid">
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
        <p className="empty-note">
          {query.trim()
            ? "No recipes match that search."
            : cookbooks.length > 0
              ? "Recipes not in a cookbook yet will show up here. Import another, or open a book above."
              : "No recipes yet. Import one above to start cooking."}
        </p>
      ) : (
        <>
          <p className="section-label">{sectionLabel}</p>
          <div className="recipe-grid">
            {listed.map((recipe) => (
              <Link className="recipe-card" key={recipe.id} href={`/recipes/${recipe.id}`}>
                <RecipeThumb recipe={recipe} />
                <div className="card-copy">
                  <h2>{recipe.title}</h2>
                  <LoveTags hits={loveHitsForRecipe(recipe, lovePeople)} />
                  <p className="muted">{recipeCardMeta(recipe)}</p>
                </div>
              </Link>
            ))}
          </div>
        </>
      )}

      <NewCookbookSheet open={open} onClose={close} />
      <KitchenToast
        message={deleted ? `Deleted ${deleted.title}` : null}
        onUndo={deleted ? () => void undoDelete(deleted) : undefined}
        onDismiss={() => setDeleted(null)}
      />
    </>
  );
}
