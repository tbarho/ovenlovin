"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import type { CookbookCard, Recipe } from "@ovenlovin/core";
import { recipeMainImage } from "@ovenlovin/core/media";
import { api } from "@/lib/browser-api";
import { ImportRecipeForm } from "./ImportRecipeForm";
import { BottomSheet } from "./BottomSheet";

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
          placeholder="Weeknight dinners"
          required
        />
        {error ? <p className="muted">{error}</p> : null}
        <button className="btn primary" type="submit" disabled={pending}>
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
}: {
  cookbooks: CookbookCard[];
  uncategorized: Recipe[];
  recipes: Recipe[];
}) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);

  const listed = cookbooks.length > 0 ? uncategorized : recipes;

  return (
    <>
      <div className="kitchen-head">
        <div>
          <h1>Recipes</h1>
          <p className="muted">
            Import a dish, file it in a cookbook, and cook from a photo-first shelf.
          </p>
        </div>
        <div className="recipe-actions" style={{ margin: 0 }}>
          <button className="btn" type="button" onClick={() => setOpen(true)}>
            New cookbook
          </button>
        </div>
      </div>
      <ImportRecipeForm />

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
          {cookbooks.length > 0
            ? "Every recipe is filed in a cookbook. Import another, or open a book above."
            : "No recipes yet. Import one above to start cooking."}
        </p>
      ) : (
        <>
          <p className="section-label">
            {cookbooks.length > 0 ? "Unfiled recipes" : "All recipes"}
          </p>
          <div className="recipe-grid">
            {listed.map((recipe) => (
              <Link className="recipe-card" key={recipe.id} href={`/recipes/${recipe.id}`}>
                <RecipeThumb recipe={recipe} />
                <div className="card-copy">
                  <h2>{recipe.title}</h2>
                  <p className="muted">
                    {[
                      recipe.servings ? `${recipe.servings} servings` : null,
                      recipe.prepTimeMinutes != null ? `${recipe.prepTimeMinutes} min prep` : null,
                      recipe.cookTimeMinutes != null ? `${recipe.cookTimeMinutes} min cook` : null,
                    ]
                      .filter(Boolean)
                      .join(" · ") || recipe.status}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </>
      )}

      <NewCookbookSheet open={open} onClose={close} />
    </>
  );
}
