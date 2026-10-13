"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import type { Cookbook, RecipeDetails } from "@ovenlovin/core";
import {
  clampServings,
  formatDurationMinutes,
  recipeGalleryImages,
  recipeMainImage,
  scaleIngredientDisplay,
} from "@ovenlovin/core";
import { api } from "@/lib/browser-api";
import { Sheet } from "./Sheet";

function sourceHost(url: string): string {
  try {
    return new URL(url).host.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export function RecipeDetail({
  recipe,
  cookbooks,
}: {
  recipe: RecipeDetails;
  cookbooks: Cookbook[];
}) {
  const router = useRouter();
  const storedServings = recipe.servings && recipe.servings > 0 ? recipe.servings : 4;
  const [servings, setServings] = useState(storedServings);
  const [sheet, setSheet] = useState<
    null | "details" | "image" | "ingredients" | "steps" | "cookbook"
  >(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState(recipe.title);
  const [prep, setPrep] = useState(recipe.prepTimeMinutes?.toString() ?? "");
  const [cook, setCook] = useState(recipe.cookTimeMinutes?.toString() ?? "");
  const [baseServings, setBaseServings] = useState(storedServings.toString());
  const [ingredientText, setIngredientText] = useState(
    recipe.ingredients.map((item) => item.rawText).join("\n")
  );
  const [stepText, setStepText] = useState(recipe.steps.map((item) => item.text).join("\n"));
  const [imageUrl, setImageUrl] = useState("");
  const [selectedBooks, setSelectedBooks] = useState(recipe.cookbooks.map((item) => item.id));

  const mainImage = recipeMainImage(recipe.images);
  const extraImages = recipeGalleryImages(recipe.images).slice(1);
  const sourceUrl = recipe.source?.canonicalUrl || recipe.source?.url || null;

  const scaledIngredients = useMemo(
    () =>
      recipe.ingredients.map((ingredient) => ({
        id: ingredient.id,
        text: scaleIngredientDisplay(ingredient, recipe.servings ?? storedServings, servings),
      })),
    [recipe.ingredients, recipe.servings, servings, storedServings]
  );

  async function save(body: Record<string, unknown>) {
    setPending(true);
    setError(null);
    try {
      await api(`/api/v1/recipes/${recipe.id}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      });
      setSheet(null);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save recipe");
    } finally {
      setPending(false);
    }
  }

  async function saveDetails(event: React.FormEvent) {
    event.preventDefault();
    const nextServings = clampServings(Number(baseServings) || storedServings);
    await save({
      title,
      servings: nextServings,
      prepTimeMinutes: prep ? Number(prep) : null,
      cookTimeMinutes: cook ? Number(cook) : null,
    });
    setServings(nextServings);
  }

  async function saveIngredients(event: React.FormEvent) {
    event.preventDefault();
    await save({
      ingredients: ingredientText
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)
        .map((rawText) => ({ rawText })),
    });
  }

  async function saveSteps(event: React.FormEvent) {
    event.preventDefault();
    await save({
      steps: stepText
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)
        .map((text) => ({ text })),
    });
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
      const next = recipe.images[0] ? [stored.url, ...recipe.images] : [stored.url];
      await save({ images: next });
      setImageUrl("");
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
      const next = recipe.images[0] ? [stored.url, ...recipe.images] : [stored.url];
      await save({ images: next });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not upload image");
      setPending(false);
    }
  }

  async function saveCookbooks(event: React.FormEvent) {
    event.preventDefault();
    await save({ cookbookIds: selectedBooks });
  }

  return (
    <>
      <div className="kitchen-head">
        <div>
          <Link href="/recipes" className="back-link">
            ← Recipes
          </Link>
          <h1>{recipe.title}</h1>
          <div className="recipe-meta">
            {formatDurationMinutes(recipe.prepTimeMinutes) ? (
              <span className="chip">Prep {formatDurationMinutes(recipe.prepTimeMinutes)}</span>
            ) : null}
            {formatDurationMinutes(recipe.cookTimeMinutes) ? (
              <span className="chip">Cook {formatDurationMinutes(recipe.cookTimeMinutes)}</span>
            ) : null}
            {recipe.cuisine ? <span className="chip">{recipe.cuisine}</span> : null}
            {recipe.cookbooks.map((book) => (
              <Link className="chip" key={book.id} href={`/recipes?cookbook=${book.id}`}>
                {book.name}
              </Link>
            ))}
          </div>
          {sourceUrl ? (
            <a className="source-link" href={sourceUrl} target="_blank" rel="noreferrer">
              View original on {sourceHost(sourceUrl)}
            </a>
          ) : null}
        </div>
      </div>

      <div className="recipe-hero">
        {mainImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={mainImage} alt={recipe.title} />
        ) : (
          <div className="recipe-hero-fallback">Add a photo of this dish</div>
        )}
      </div>
      {extraImages.length > 0 ? (
        <div className="recipe-actions">
          {extraImages.map((src) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={src}
              src={src}
              alt=""
              style={{ width: 72, height: 72, objectFit: "cover", borderRadius: 10 }}
            />
          ))}
        </div>
      ) : null}

      <div className="recipe-actions">
        <button className="btn" type="button" onClick={() => setSheet("details")}>
          Edit details
        </button>
        <button className="btn" type="button" onClick={() => setSheet("image")}>
          Edit image
        </button>
        <button className="btn" type="button" onClick={() => setSheet("ingredients")}>
          Edit ingredients
        </button>
        <button className="btn" type="button" onClick={() => setSheet("steps")}>
          Edit steps
        </button>
        <button className="btn" type="button" onClick={() => setSheet("cookbook")}>
          Cookbooks
        </button>
      </div>

      <div className="servings-card">
        <header>
          <strong>Servings</strong>
          <span>{servings}</span>
        </header>
        <input
          type="range"
          min={1}
          max={24}
          value={servings}
          onChange={(event) => setServings(clampServings(Number(event.target.value)))}
        />
        <p className="muted">
          Scales from {recipe.servings ?? storedServings} stored servings. Units stay as written.
        </p>
      </div>

      {recipe.description ? <p>{recipe.description}</p> : null}

      <div className="recipe-view">
        <section>
          <h2>Ingredients</h2>
          {scaledIngredients.length === 0 ? (
            <p className="muted">No ingredients stored for this recipe.</p>
          ) : (
            <ul>
              {scaledIngredients.map((ingredient) => (
                <li key={ingredient.id}>{ingredient.text}</li>
              ))}
            </ul>
          )}
        </section>
        <section>
          <h2>Steps</h2>
          {recipe.steps.length === 0 ? (
            <p className="muted">No steps stored for this recipe.</p>
          ) : (
            <ol>
              {recipe.steps.map((step) => (
                <li key={step.id}>{step.text}</li>
              ))}
            </ol>
          )}
        </section>
      </div>

      <Sheet open={sheet === "details"} title="Edit details" onClose={() => setSheet(null)}>
        <form className="form-card" style={{ margin: 0 }} onSubmit={saveDetails}>
          <label>
            Title
            <input value={title} onChange={(event) => setTitle(event.target.value)} required />
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
          {error && sheet === "details" ? <p className="muted">{error}</p> : null}
          <button className="btn primary" type="submit" disabled={pending}>
            {pending ? "Saving…" : "Save details"}
          </button>
        </form>
      </Sheet>

      <Sheet open={sheet === "image"} title="Recipe photos" onClose={() => setSheet(null)}>
        <form className="form-card" style={{ margin: 0 }} onSubmit={addImageFromUrl}>
          <p className="muted">The first photo is the main image on cards and this page.</p>
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
          {error && sheet === "image" ? <p className="muted">{error}</p> : null}
        </form>
      </Sheet>

      <Sheet open={sheet === "ingredients"} title="Edit ingredients" onClose={() => setSheet(null)}>
        <form className="form-card" style={{ margin: 0 }} onSubmit={saveIngredients}>
          <p className="muted">One ingredient per line. Quantities scale when you move servings.</p>
          <textarea
            value={ingredientText}
            onChange={(event) => setIngredientText(event.target.value)}
            required
          />
          {error && sheet === "ingredients" ? <p className="muted">{error}</p> : null}
          <button className="btn primary" type="submit" disabled={pending}>
            {pending ? "Saving…" : "Save ingredients"}
          </button>
        </form>
      </Sheet>

      <Sheet open={sheet === "steps"} title="Edit steps" onClose={() => setSheet(null)}>
        <form className="form-card" style={{ margin: 0 }} onSubmit={saveSteps}>
          <p className="muted">One step per line.</p>
          <textarea
            value={stepText}
            onChange={(event) => setStepText(event.target.value)}
            required
          />
          {error && sheet === "steps" ? <p className="muted">{error}</p> : null}
          <button className="btn primary" type="submit" disabled={pending}>
            {pending ? "Saving…" : "Save steps"}
          </button>
        </form>
      </Sheet>

      <Sheet open={sheet === "cookbook"} title="Cookbooks" onClose={() => setSheet(null)}>
        <form className="form-card" style={{ margin: 0 }} onSubmit={saveCookbooks}>
          {cookbooks.length === 0 ? (
            <p className="muted">Create a cookbook from the Recipes shelf first.</p>
          ) : (
            cookbooks.map((book) => (
              <label key={book.id} style={{ display: "flex", gap: 8, alignItems: "center" }}>
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
          {error && sheet === "cookbook" ? <p className="muted">{error}</p> : null}
          <button className="btn primary" type="submit" disabled={pending}>
            {pending ? "Saving…" : "Save cookbooks"}
          </button>
        </form>
      </Sheet>
    </>
  );
}
