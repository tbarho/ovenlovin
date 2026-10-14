"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import type { PersonLove } from "@ovenlovin/allergens";
import type { Cookbook, Recipe } from "@ovenlovin/core";
import { recipeMainImage } from "@ovenlovin/core/media";
import { api } from "@/lib/browser-api";
import { loveHitsForRecipe } from "@/lib/household-loves";
import { BottomSheet } from "./BottomSheet";
import { ConfirmDialog } from "./ConfirmDialog";
import { LoveTags } from "./LoveTags";

const EMPTY_LOVE_PEOPLE: PersonLove[] = [];

function RenameCookbookSheet({
  cookbook,
  open,
  onClose,
}: {
  cookbook: Cookbook;
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [name, setName] = useState(cookbook.name);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setName(cookbook.name);
      setError(null);
    }
  }, [open, cookbook.name]);

  async function rename(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      await api(`/api/v1/cookbooks/${cookbook.id}`, {
        method: "PATCH",
        body: JSON.stringify({ name }),
      });
      onClose();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not rename cookbook");
    } finally {
      setPending(false);
    }
  }

  return (
    <BottomSheet open={open} title="Rename cookbook" onClose={onClose}>
      <form className="form-card" style={{ margin: 0 }} onSubmit={rename}>
        <input value={name} onChange={(event) => setName(event.target.value)} required />
        {error ? <p className="muted">{error}</p> : null}
        <button className="btn primary" type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save name"}
        </button>
      </form>
    </BottomSheet>
  );
}

export function CookbookRecipes({
  cookbook,
  recipes,
  lovePeople = EMPTY_LOVE_PEOPLE,
}: {
  cookbook: Cookbook;
  recipes: Recipe[];
  lovePeople?: PersonLove[];
}) {
  const router = useRouter();
  const [renameOpen, setRenameOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const closeRename = useCallback(() => setRenameOpen(false), []);

  async function remove() {
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
          <button
            className="btn"
            type="button"
            onClick={() => setDeleteOpen(true)}
            disabled={pending}
          >
            Delete
          </button>
        </div>
      </div>

      {error ? <p className="muted">{error}</p> : null}

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
                  <LoveTags hits={loveHitsForRecipe(recipe, lovePeople)} />
                  <p className="muted">
                    {recipe.servings ? `${recipe.servings} servings` : recipe.status}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      <RenameCookbookSheet cookbook={cookbook} open={renameOpen} onClose={closeRename} />
      <ConfirmDialog
        open={deleteOpen}
        title="Delete cookbook"
        body={`Delete “${cookbook.name}”? Recipes stay in your kitchen.`}
        confirmLabel="Delete cookbook"
        danger
        pending={pending}
        onCancel={() => setDeleteOpen(false)}
        onConfirm={remove}
      />
    </>
  );
}
