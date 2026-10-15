"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import type { Cookbook, RecipeDetails } from "@ovenlovin/core";
import { keepMainRecipeImages, recipeMainImage } from "@ovenlovin/core/media";
import { clampServings } from "@ovenlovin/core/scaling";
import { api } from "@/lib/browser-api";
import { BottomSheet } from "./BottomSheet";

function RecipeSheet({
  open,
  title,
  dirty,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  dirty: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  const [confirm, setConfirm] = useState(false);

  useEffect(() => {
    if (!open) setConfirm(false);
  }, [open]);

  function requestClose() {
    if (confirm) {
      setConfirm(false);
      return;
    }
    if (dirty) {
      setConfirm(true);
      return;
    }
    onClose();
  }

  return (
    <BottomSheet open={open} title={title} onClose={requestClose}>
      {confirm ? (
        <div className="sheet-discard" data-testid="discard-changes">
          <p className="sheet-lead">Discard unsaved changes?</p>
          <div className="sheet-actions">
            <button type="button" className="btn" onClick={() => setConfirm(false)}>
              Keep editing
            </button>
            <button type="button" className="btn danger" onClick={onClose}>
              Discard
            </button>
          </div>
        </div>
      ) : (
        children
      )}
    </BottomSheet>
  );
}

function useRecipePatch(recipeId: string, onClose: () => void) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const patch = useCallback(
    async (body: Record<string, unknown>) => {
      setPending(true);
      setError(null);
      try {
        await api(`/api/v1/recipes/${recipeId}`, {
          method: "PATCH",
          body: JSON.stringify(body),
        });
        onClose();
        router.refresh();
        return true;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not save recipe");
        return false;
      } finally {
        setPending(false);
      }
    },
    [onClose, recipeId, router]
  );

  return { pending, error, setError, setPending, patch };
}

export function DetailsSheet({
  recipe,
  open,
  onClose,
  onSavedServings,
}: {
  recipe: RecipeDetails;
  open: boolean;
  onClose: () => void;
  onSavedServings: (servings: number) => void;
}) {
  const storedServings = recipe.servings && recipe.servings > 0 ? recipe.servings : 4;
  const [title, setTitle] = useState(recipe.title);
  const [notes, setNotes] = useState(recipe.notes ?? "");
  const [prep, setPrep] = useState(recipe.prepTimeMinutes?.toString() ?? "");
  const [cook, setCook] = useState(recipe.cookTimeMinutes?.toString() ?? "");
  const [baseServings, setBaseServings] = useState(storedServings.toString());
  const [cuisine, setCuisine] = useState(recipe.cuisine ?? "");
  const { pending, error, patch } = useRecipePatch(recipe.id, onClose);

  useEffect(() => {
    if (!open) return;
    setTitle(recipe.title);
    setNotes(recipe.notes ?? "");
    setPrep(recipe.prepTimeMinutes?.toString() ?? "");
    setCook(recipe.cookTimeMinutes?.toString() ?? "");
    setBaseServings((recipe.servings && recipe.servings > 0 ? recipe.servings : 4).toString());
    setCuisine(recipe.cuisine ?? "");
  }, [open, recipe]);

  async function saveDetails(event: React.FormEvent) {
    event.preventDefault();
    const nextServings = clampServings(Number(baseServings) || storedServings);
    const saved = await patch({
      title,
      notes: notes.trim() ? notes.trim() : null,
      servings: nextServings,
      cuisine: cuisine.trim() ? cuisine.trim() : null,
      prepTimeMinutes: prep ? Number(prep) : null,
      cookTimeMinutes: cook ? Number(cook) : null,
    });
    if (saved) onSavedServings(nextServings);
  }

  const dirty =
    title !== recipe.title ||
    notes !== (recipe.notes ?? "") ||
    prep !== (recipe.prepTimeMinutes?.toString() ?? "") ||
    cook !== (recipe.cookTimeMinutes?.toString() ?? "") ||
    baseServings !== storedServings.toString();

  return (
    <RecipeSheet open={open} title="Edit details" dirty={dirty} onClose={onClose}>
      <form className="form-card" style={{ margin: 0 }} onSubmit={saveDetails}>
        <label>
          Title
          <input value={title} onChange={(event) => setTitle(event.target.value)} required />
        </label>
        <label>
          Notes
          <textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            rows={3}
            placeholder="Make-ahead tips, substitutions, serving notes"
          />
        </label>
        <label>
          Servings
          <input
            type="number"
            min={1}
            max={24}
            value={baseServings}
            onChange={(event) => setBaseServings(event.target.value)}
          />
        </label>
        <label>
          Cuisine
          <input
            value={cuisine}
            onChange={(event) => setCuisine(event.target.value)}
            placeholder="Italian, Mexican…"
          />
        </label>
        <label>
          Prep time (minutes)
          <input
            type="number"
            min={0}
            value={prep}
            onChange={(event) => setPrep(event.target.value)}
          />
        </label>
        <label>
          Cook time (minutes)
          <input
            type="number"
            min={0}
            value={cook}
            onChange={(event) => setCook(event.target.value)}
          />
        </label>
        {error ? <p className="muted">{error}</p> : null}
        <button className="btn primary" type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save details"}
        </button>
      </form>
    </RecipeSheet>
  );
}

export function PhotosSheet({
  recipe,
  open,
  onClose,
}: {
  recipe: RecipeDetails;
  open: boolean;
  onClose: () => void;
}) {
  const [imageUrl, setImageUrl] = useState("");
  const { pending, error, setError, setPending, patch } = useRecipePatch(recipe.id, onClose);
  const currentImage = recipeMainImage(recipe.images);
  const preview = imageUrl.trim() || currentImage;

  useEffect(() => {
    if (open) setImageUrl("");
  }, [open]);

  async function removePhoto() {
    await patch({ images: [] });
  }

  async function addImageFromUrl(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      const stored = await api<{ url: string }>("/api/v1/uploads/images", {
        method: "POST",
        body: JSON.stringify({ url: imageUrl }),
      });
      const next = keepMainRecipeImages([stored.url]);
      const saved = await patch({ images: next });
      if (saved) setImageUrl("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add image");
      setPending(false);
    }
  }

  async function addImageFile(file: File) {
    setPending(true);
    setError(null);
    try {
      const data = new FormData();
      data.append("file", file);
      const response = await fetch("/api/v1/uploads/images", {
        method: "POST",
        credentials: "include",
        body: data,
      });
      if (!response.ok) {
        const problem = (await response.json().catch(() => ({ title: response.statusText }))) as {
          detail?: string;
          title?: string;
        };
        throw new Error(problem.detail || problem.title || "Upload failed");
      }
      const stored = (await response.json()) as { url: string };
      const next = keepMainRecipeImages([stored.url]);
      await patch({ images: next });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not upload image");
      setPending(false);
    }
  }

  return (
    <RecipeSheet
      open={open}
      title="Recipe photo"
      dirty={Boolean(imageUrl.trim())}
      onClose={onClose}
    >
      <form className="form-card" style={{ margin: 0 }} onSubmit={addImageFromUrl}>
        <p className="muted">
          JPEG, PNG, or WebP · about 8 MB. This replaces the main photo on cards and this page.
        </p>
        {preview ? (
          <div className="photo-preview">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={preview} alt="Recipe photo preview" />
          </div>
        ) : (
          <p className="muted">No photo yet.</p>
        )}
        <label>
          Photo URL
          <input
            value={imageUrl}
            onChange={(event) => setImageUrl(event.target.value)}
            placeholder="https://example.com/pasta.jpg"
          />
        </label>
        <button className="btn primary" type="submit" disabled={pending || !imageUrl}>
          {pending ? "Saving…" : "Use this URL"}
        </button>
        <label>
          Choose file
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,image/*"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void addImageFile(file);
            }}
          />
        </label>
        {currentImage ? (
          <button
            className="btn"
            type="button"
            disabled={pending}
            onClick={() => void removePhoto()}
          >
            Remove photo
          </button>
        ) : null}
        {error ? <p className="muted">{error}</p> : null}
      </form>
    </RecipeSheet>
  );
}

export function IngredientsSheet({
  recipe,
  open,
  onClose,
}: {
  recipe: RecipeDetails;
  open: boolean;
  onClose: () => void;
}) {
  const [ingredientText, setIngredientText] = useState(
    recipe.ingredients.map((item) => item.rawText).join("\n")
  );
  const { pending, error, patch } = useRecipePatch(recipe.id, onClose);

  useEffect(() => {
    if (!open) return;
    setIngredientText(recipe.ingredients.map((item) => item.rawText).join("\n"));
  }, [open, recipe.ingredients]);

  async function saveIngredients(event: React.FormEvent) {
    event.preventDefault();
    await patch({
      ingredients: ingredientText
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)
        .map((rawText) => ({ rawText })),
    });
  }

  const original = recipe.ingredients.map((item) => item.rawText).join("\n");
  return (
    <RecipeSheet
      open={open}
      title="Edit ingredients"
      dirty={ingredientText !== original}
      onClose={onClose}
    >
      <form className="form-card" style={{ margin: 0 }} onSubmit={saveIngredients}>
        <label>
          Ingredients
          <span className="muted">
            One ingredient per line. Quantities scale when you move servings.
          </span>
          <textarea
            value={ingredientText}
            onChange={(event) => setIngredientText(event.target.value)}
            required
          />
        </label>
        {error ? <p className="muted">{error}</p> : null}
        <button className="btn primary" type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save ingredients"}
        </button>
      </form>
    </RecipeSheet>
  );
}

export function StepsSheet({
  recipe,
  open,
  onClose,
}: {
  recipe: RecipeDetails;
  open: boolean;
  onClose: () => void;
}) {
  const [stepText, setStepText] = useState(recipe.steps.map((item) => item.text).join("\n"));
  const { pending, error, patch } = useRecipePatch(recipe.id, onClose);

  useEffect(() => {
    if (!open) return;
    setStepText(recipe.steps.map((item) => item.text).join("\n"));
  }, [open, recipe.steps]);

  async function saveSteps(event: React.FormEvent) {
    event.preventDefault();
    await patch({
      steps: stepText
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)
        .map((text) => ({ text })),
    });
  }

  const original = recipe.steps.map((item) => item.text).join("\n");
  return (
    <RecipeSheet open={open} title="Edit steps" dirty={stepText !== original} onClose={onClose}>
      <form className="form-card" style={{ margin: 0 }} onSubmit={saveSteps}>
        <label>
          Steps
          <span className="muted">One step per line.</span>
          <textarea
            value={stepText}
            onChange={(event) => setStepText(event.target.value)}
            required
          />
        </label>
        {error ? <p className="muted">{error}</p> : null}
        <button className="btn primary" type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save steps"}
        </button>
      </form>
    </RecipeSheet>
  );
}

export function CookbooksSheet({
  recipe,
  cookbooks,
  open,
  onClose,
}: {
  recipe: RecipeDetails;
  cookbooks: Cookbook[];
  open: boolean;
  onClose: () => void;
}) {
  const [selectedBooks, setSelectedBooks] = useState(recipe.cookbooks.map((item) => item.id));
  const { pending, error, patch } = useRecipePatch(recipe.id, onClose);

  useEffect(() => {
    if (!open) return;
    setSelectedBooks(recipe.cookbooks.map((item) => item.id));
  }, [open, recipe.cookbooks]);

  async function saveCookbooks(event: React.FormEvent) {
    event.preventDefault();
    await patch({ cookbookIds: selectedBooks });
  }

  const original = recipe.cookbooks.map((item) => item.id);
  const dirty =
    selectedBooks.length !== original.length || selectedBooks.some((id) => !original.includes(id));
  return (
    <RecipeSheet open={open} title="Cookbooks" dirty={dirty} onClose={onClose}>
      <form className="form-card" style={{ margin: 0 }} onSubmit={saveCookbooks}>
        {cookbooks.length === 0 ? (
          <p className="muted">Create a cookbook from the Recipes shelf first.</p>
        ) : (
          cookbooks.map((book) => (
            <label className="check-row" key={book.id}>
              <input
                type="checkbox"
                checked={selectedBooks.includes(book.id)}
                onChange={(event) => {
                  setSelectedBooks((current) =>
                    event.target.checked
                      ? [...current, book.id]
                      : current.filter((id) => id !== book.id)
                  );
                }}
              />
              {book.name}
            </label>
          ))
        )}
        {error ? <p className="muted">{error}</p> : null}
        <button className="btn primary" type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save cookbooks"}
        </button>
      </form>
    </RecipeSheet>
  );
}
