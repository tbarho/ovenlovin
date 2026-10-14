"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/browser-api";
import type { RecipeDetails } from "@ovenlovin/core";

export function ImportRecipeForm() {
  const router = useRouter();
  const [source, setSource] = useState<"url" | "paste">("url");
  const [content, setContent] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      const recipe = await api<RecipeDetails>("/api/v1/recipes/import", {
        method: "POST",
        body: JSON.stringify({ source, content }),
      });
      router.push(`/recipes/${recipe.id}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not import recipe");
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="form-card import-card" onSubmit={onSubmit}>
      <div className="import-toolbar">
        <h2>Import a recipe</h2>
        <div className="tabs import-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            className="tab"
            aria-selected={source === "url"}
            onClick={() => setSource("url")}
          >
            URL
          </button>
          <button
            type="button"
            role="tab"
            className="tab"
            aria-selected={source === "paste"}
            onClick={() => setSource("paste")}
          >
            Paste
          </button>
        </div>
      </div>
      <div className="import-row">
        <div className="import-field">
          {source === "url" ? (
            <input
              value={content}
              onChange={(event) => setContent(event.target.value)}
              placeholder="https://example.com/chocolate-chip-cookies"
              required
            />
          ) : (
            <textarea
              value={content}
              onChange={(event) => setContent(event.target.value)}
              placeholder={
                "Weeknight tomato pasta\n\nIngredients\n- 12 oz pasta\n- 1 jar tomatoes\n\nSteps\nBoil pasta. Warm sauce. Combine."
              }
              required
            />
          )}
        </div>
        <button className="btn primary import-submit" type="submit" disabled={pending}>
          {pending ? "Importing…" : "Import"}
        </button>
      </div>
      {error ? <p className="muted import-error">{error}</p> : null}
    </form>
  );
}
