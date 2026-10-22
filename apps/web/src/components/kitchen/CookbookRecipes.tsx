"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { PersonLove } from "@ovenlovin/allergens";
import type { Cookbook, Recipe } from "@ovenlovin/core";
import { recipeMainImage } from "@ovenlovin/core/media";
import { api } from "@/lib/browser-api";
import { recipeCardMeta } from "@/lib/recipe-card-meta";
import { EMPTY_RECIPE_SAFETY, type RecipeSafetySummary } from "@/lib/recipe-card-safety";
import { BottomSheet } from "./BottomSheet";
import { CookbookRecipePicker } from "./CookbookRecipePicker";
import { ConfirmDialog } from "./ConfirmDialog";
import { KitchenToast } from "./KitchenToast";
import { RecipeCardSafety } from "./RecipeCardSafety";

const EMPTY_LOVE_PEOPLE: PersonLove[] = [];
const EMPTY_RECIPES: Recipe[] = [];

function RecipeCardMenu({ pending, onRemove }: { pending: boolean; onRemove: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="recipe-card-menu">
      <button
        type="button"
        className="recipe-card-more hit44"
        aria-label="Recipe actions"
        aria-expanded={open}
        title="More actions"
        onClick={() => setOpen((value) => !value)}
      >
        ⋯
      </button>
      {open ? (
        <div className="recipe-card-menu-list" role="menu">
          <button
            type="button"
            role="menuitem"
            disabled={pending}
            onClick={() => {
              setOpen(false);
              onRemove();
            }}
          >
            Remove
          </button>
        </div>
      ) : null}
    </div>
  );
}

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
  catalog = EMPTY_RECIPES,
  booksByRecipe = {},
  lovePeople = EMPTY_LOVE_PEOPLE,
  safetyByRecipe = {},
}: {
  cookbook: Cookbook;
  recipes: Recipe[];
  catalog?: Recipe[];
  booksByRecipe?: Record<string, string[]>;
  lovePeople?: PersonLove[];
  safetyByRecipe?: Record<string, RecipeSafetySummary>;
}) {
  const router = useRouter();
  const [renameOpen, setRenameOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; recipeId?: string } | null>(null);
  const closeRename = useCallback(() => setRenameOpen(false), []);
  const closeAdd = useCallback(() => setAddOpen(false), []);
  const dismissToast = useCallback(() => setToast(null), []);
  const memberIds = useMemo(() => new Set(recipes.map((recipe) => recipe.id)), [recipes]);

  async function removeCookbook() {
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

  async function addRecipes(recipeIds: string[]) {
    setPending(true);
    setError(null);
    try {
      for (const recipeId of recipeIds) {
        await api(`/api/v1/cookbooks/${cookbook.id}/recipes`, {
          method: "POST",
          body: JSON.stringify({ recipeId }),
        });
      }
      setAddOpen(false);
      setToast({
        message:
          recipeIds.length === 1
            ? `Added to ${cookbook.name}`
            : `Added ${recipeIds.length} recipes`,
      });
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add recipes");
    } finally {
      setPending(false);
    }
  }

  async function removeRecipe(recipeId: string) {
    setPending(true);
    setError(null);
    const title = recipes.find((recipe) => recipe.id === recipeId)?.title ?? "recipe";
    try {
      await api(`/api/v1/cookbooks/${cookbook.id}/recipes?recipeId=${recipeId}`, {
        method: "DELETE",
      });
      setToast({ message: `Removed ${title}`, recipeId });
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not remove recipe");
    } finally {
      setPending(false);
    }
  }

  async function undoRemove(recipeId: string) {
    setToast(null);
    setPending(true);
    setError(null);
    try {
      await api(`/api/v1/cookbooks/${cookbook.id}/recipes`, {
        method: "POST",
        body: JSON.stringify({ recipeId }),
      });
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not undo");
    } finally {
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
          <button className="btn primary" type="button" onClick={() => setAddOpen(true)}>
            Add recipes
          </button>
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
        <div className="empty-card">
          <p>This cookbook is empty.</p>
          <button className="btn primary" type="button" onClick={() => setAddOpen(true)}>
            Add recipes
          </button>
        </div>
      ) : (
        <div className="recipe-grid">
          {recipes.map((recipe) => {
            const image = recipeMainImage(recipe.images);
            return (
              <article className="recipe-card cookbook-member-card" key={recipe.id}>
                <Link href={`/recipes/${recipe.id}?fromCookbook=${cookbook.id}`}>
                  {image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={image} alt="" />
                  ) : (
                    <div className="thumb-fallback">{recipe.title.slice(0, 1)}</div>
                  )}
                  <div className="card-copy">
                    <h2>{recipe.title}</h2>
                    <RecipeCardSafety
                      recipe={recipe}
                      lovePeople={lovePeople}
                      safety={safetyByRecipe[recipe.id] ?? EMPTY_RECIPE_SAFETY}
                    />
                    <p className="muted">{recipeCardMeta(recipe)}</p>
                  </div>
                </Link>
                <RecipeCardMenu pending={pending} onRemove={() => void removeRecipe(recipe.id)} />
              </article>
            );
          })}
        </div>
      )}

      <RenameCookbookSheet cookbook={cookbook} open={renameOpen} onClose={closeRename} />
      <CookbookRecipePicker
        open={addOpen}
        recipes={catalog}
        memberIds={memberIds}
        booksByRecipe={booksByRecipe}
        cookbookName={cookbook.name}
        pending={pending}
        error={error}
        onClose={closeAdd}
        onAdd={addRecipes}
      />
      <ConfirmDialog
        open={deleteOpen}
        title="Delete cookbook"
        body={`Delete “${cookbook.name}”? Recipes stay in your kitchen.`}
        confirmLabel="Delete cookbook"
        danger
        pending={pending}
        error={error}
        onCancel={() => setDeleteOpen(false)}
        onConfirm={removeCookbook}
      />
      <KitchenToast
        message={toast?.message ?? null}
        onUndo={
          toast?.recipeId
            ? () => {
                const recipeId = toast.recipeId;
                if (recipeId) void undoRemove(recipeId);
              }
            : undefined
        }
        onDismiss={dismissToast}
      />
    </>
  );
}
