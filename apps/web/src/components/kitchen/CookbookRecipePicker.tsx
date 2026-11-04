"use client";

import { useEffect, useMemo, useState } from "react";
import type { Recipe } from "@ovenlovin/core";
import { recipeMainImage } from "@ovenlovin/core/media";
import { Button } from "@/components/ui";
import { filterRecipesByQuery, pickerBookNote } from "@/lib/cookbook-recipes";
import { BottomSheet } from "./BottomSheet";

function RecipePickRow({
  recipe,
  inBook,
  otherBooks,
  selected,
  onToggle,
}: {
  recipe: Recipe;
  inBook: boolean;
  otherBooks: string[];
  selected: boolean;
  onToggle: () => void;
}) {
  const image = recipeMainImage(recipe.images);
  const note = pickerBookNote(inBook, otherBooks);
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
        {note ? <em>{note}</em> : null}
      </span>
    </label>
  );
}

export function CookbookRecipePicker({
  open,
  recipes,
  memberIds,
  booksByRecipe = {},
  cookbookName,
  pending,
  error,
  onClose,
  onAdd,
}: {
  open: boolean;
  recipes: Recipe[];
  memberIds: Set<string>;
  booksByRecipe?: Record<string, string[]>;
  cookbookName?: string;
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
        <label className="field">
          <span className="field-label">Search recipes</span>
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
              const otherBooks = (booksByRecipe[recipe.id] ?? []).filter(
                (name) => name !== cookbookName
              );
              return (
                <li key={recipe.id}>
                  <RecipePickRow
                    recipe={recipe}
                    inBook={inBook}
                    otherBooks={otherBooks}
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
          <Button type="button" variant="secondary" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button
            type="button"
            disabled={pending || selected.length === 0}
            loading={pending}
            onClick={() => onAdd(selected)}
          >
            {selected.length === 1 ? "Add 1 recipe" : `Add ${selected.length} recipes`}
          </Button>
        </div>
      </div>
    </BottomSheet>
  );
}
