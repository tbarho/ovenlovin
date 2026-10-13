"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Cookbook, Recipe } from "@ovenlovin/core";
import { recipeMainImage } from "@ovenlovin/core";
import { api } from "@/lib/browser-api";
import { Sheet } from "./Sheet";

export function CookbookRecipes({ cookbook, recipes }: { cookbook: Cookbook; recipes: Recipe[] }) {
  const router = useRouter();
  const [renameOpen, setRenameOpen] = useState(false);
  const [name, setName] = useState(cookbook.name);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function rename(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      await api(`/api/v1/cookbooks/${cookbook.id}`, {
        method: "PATCH",
        body: JSON.stringify({ name }),
      });
      setRenameOpen(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not rename cookbook");
    } finally {
      setPending(false);
    }
  }

  async function remove() {
    if (!confirm(`Delete “${cookbook.name}”? Recipes stay in your kitchen.`)) return;
    setPending(true);
    try {
      await api(`/api/v1/cookbooks/${cookbook.id}`, { method: "DELETE" });
      router.push("/recipes");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete cookbook");
      setPending(false);
    }
  }

  return (
    <>
      <div className="kitchen-head">
        <div>
          <Link href="/recipes" className="back-link">
            ← Recipes
          </Link>
          <h1>{cookbook.name}</h1>
          <p className="muted">
            {recipes.length} {recipes.length === 1 ? "recipe" : "recipes"} in this book.
          </p>
        </div>
        <div className="recipe-actions" style={{ margin: 0 }}>
          <button className="btn" type="button" onClick={() => setRenameOpen(true)}>
            Rename
          </button>
          <button className="btn" type="button" onClick={remove} disabled={pending}>
            Delete
          </button>
        </div>
      </div>

      {recipes.length === 0 ? (
        <p className="empty-note">This cookbook is empty. Open a recipe and add it from Edit.</p>
      ) : (
        <div className="recipe-grid">
          {recipes.map((recipe) => {
            const image = recipeMainImage(recipe.images);
            return (
              <Link className="recipe-card" key={recipe.id} href={`/recipes/${recipe.id}`}>
                {image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={image} alt="" />
                ) : (
                  <div className="thumb-fallback">{recipe.title.slice(0, 1)}</div>
                )}
                <div className="card-copy">
                  <h2>{recipe.title}</h2>
                  <p className="muted">
                    {recipe.servings ? `${recipe.servings} servings` : recipe.status}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      <Sheet open={renameOpen} title="Rename cookbook" onClose={() => setRenameOpen(false)}>
        <form className="form-card" style={{ margin: 0 }} onSubmit={rename}>
          <input value={name} onChange={(event) => setName(event.target.value)} required />
          {error ? <p className="muted">{error}</p> : null}
          <button className="btn primary" type="submit" disabled={pending}>
            {pending ? "Saving…" : "Save name"}
          </button>
        </form>
      </Sheet>
    </>
  );
}
