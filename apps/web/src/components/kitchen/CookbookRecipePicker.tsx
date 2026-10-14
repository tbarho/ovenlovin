"use client";

import { useEffect, useMemo, useState } from "react";
import type { Recipe } from "@ovenlovin/core";
import { recipeMainImage } from "@ovenlovin/core/media";
import { filterRecipesByQuery } from "@/lib/cookbook-recipes";
import { BottomSheet } from "./BottomSheet";

function RecipePickRow({
  recipe,
  inBook,
  selected,
  onToggle,
}: {
  recipe: Recipe;
  inBook: boolean;
  selected: boolean;
  onToggle: () => void;
}) {
  const image = recipeMainImage(recipe.images);
  return (
    <label className={`recipe-pick-row${inBook ? " is-in-book" : ""}`}>
      <input type="checkbox" checked={inBook || selected} disabled={inBook} onChange={onToggle} />
      {image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={image} alt="" />
      ) : (
        <span className="thumb-fallback" aria-hidden="true">
          {recipe.title.slice(0, 1)}
        </span>
      )}
      <span className="recipe-pick-copy">
        <strong>{recipe.title}</strong>
        {inBook ? <em>Already in this book</em> : null}
      </span>
    </label>
  );
}

export function CookbookRecipePicker({
  open,
  recipes,
  memberIds,
  pending,
  error,
  onClose,
  onAdd,
}: {
  open: boolean;
  recipes: Recipe[];
  memberIds: Set<string>;
  pending: boolean;
  error: string | null;
  onClose: () => void;
  onAdd: (recipeIds: string[]) => void;
}) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string[]>([]);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setSelected([]);
  }, [open]);

  const visible = useMemo(() => filterRecipesByQuery(recipes, query), [recipes, query]);

  return (
    <BottomSheet open={open} title="Add recipes" layout="picker" onClose={onClose}>
      <div className="recipe-picker">
        <label>
          Search recipes
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Pesto, soup, cookies…"
          />
        </label>
        {visible.length === 0 ? (
          <p className="muted">No recipes match that search.</p>
        ) : (
          <ul className="recipe-pick-list">
            {visible.map((recipe) => {
              const inBook = memberIds.has(recipe.id);
              return (
                <li key={recipe.id}>
                  <RecipePickRow
                    recipe={recipe}
                    inBook={inBook}
                    selected={selected.includes(recipe.id)}
                    onToggle={() =>
                      setSelected((current) =>
                        current.includes(recipe.id)
                          ? current.filter((id) => id !== recipe.id)
                          : [...current, recipe.id]
                      )
                    }
                  />
                </li>
              );
            })}
          </ul>
        )}
        {error ? <p className="muted">{error}</p> : null}
        <div className="sheet-actions">
          <button type="button" className="btn" onClick={onClose} disabled={pending}>
            Cancel
          </button>
          <button
            type="button"
            className="btn primary"
            disabled={pending || selected.length === 0}
            onClick={() => onAdd(selected)}
          >
            {pending
              ? "Adding…"
              : selected.length === 1
                ? "Add 1 recipe"
                : `Add ${selected.length} recipes`}
          </button>
        </div>
      </div>
    </BottomSheet>
  );
}
