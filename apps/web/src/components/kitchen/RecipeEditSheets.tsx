"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Cookbook, RecipeDetails } from "@ovenlovin/core";
import { keepMainRecipeImages } from "@ovenlovin/core/media";
import { clampServings } from "@ovenlovin/core/scaling";
import { api } from "@/lib/browser-api";
import { BottomSheet } from "./BottomSheet";

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
  const { pending, error, patch } = useRecipePatch(recipe.id, onClose);

  useEffect(() => {
    if (!open) return;
    setTitle(recipe.title);
    setNotes(recipe.notes ?? "");
    setPrep(recipe.prepTimeMinutes?.toString() ?? "");
    setCook(recipe.cookTimeMinutes?.toString() ?? "");
    setBaseServings((recipe.servings && recipe.servings > 0 ? recipe.servings : 4).toString());
  }, [open, recipe]);

  async function saveDetails(event: React.FormEvent) {
    event.preventDefault();
    const nextServings = clampServings(Number(baseServings) || storedServings);
    const saved = await patch({
      title,
      notes: notes.trim() ? notes.trim() : null,
      servings: nextServings,
      prepTimeMinutes: prep ? Number(prep) : null,
      cookTimeMinutes: cook ? Number(cook) : null,
    });
    if (saved) onSavedServings(nextServings);
  }

  return (
    <BottomSheet open={open} title="Edit details" onClose={onClose}>
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
    </BottomSheet>
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

  useEffect(() => {
    if (open) setImageUrl("");
  }, [open]);

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
    <BottomSheet open={open} title="Recipe photo" onClose={onClose}>
      <form className="form-card" style={{ margin: 0 }} onSubmit={addImageFromUrl}>
        <p className="muted">This replaces the main photo on cards and this page.</p>
        <input
          value={imageUrl}
          onChange={(event) => setImageUrl(event.target.value)}
          placeholder="https://example.com/pasta.jpg"
        />
        <button className="btn primary" type="submit" disabled={pending || !imageUrl}>
          {pending ? "Saving…" : "Use this URL"}
        </button>
        <input
          type="file"
          accept="image/*"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void addImageFile(file);
          }}
        />
        {error ? <p className="muted">{error}</p> : null}
      </form>
    </BottomSheet>
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

  return (
    <BottomSheet open={open} title="Edit ingredients" onClose={onClose}>
      <form className="form-card" style={{ margin: 0 }} onSubmit={saveIngredients}>
        <p className="muted">One ingredient per line. Quantities scale when you move servings.</p>
        <textarea
          value={ingredientText}
          onChange={(event) => setIngredientText(event.target.value)}
          required
        />
        {error ? <p className="muted">{error}</p> : null}
        <button className="btn primary" type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save ingredients"}
        </button>
      </form>
    </BottomSheet>
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

  return (
    <BottomSheet open={open} title="Edit steps" onClose={onClose}>
      <form className="form-card" style={{ margin: 0 }} onSubmit={saveSteps}>
        <p className="muted">One step per line.</p>
        <textarea value={stepText} onChange={(event) => setStepText(event.target.value)} required />
        {error ? <p className="muted">{error}</p> : null}
        <button className="btn primary" type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save steps"}
        </button>
      </form>
    </BottomSheet>
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

  return (
    <BottomSheet open={open} title="Cookbooks" onClose={onClose}>
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
    </BottomSheet>
  );
}
