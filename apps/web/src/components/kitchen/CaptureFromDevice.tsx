"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { RecipeDetails } from "@ovenlovin/core";
import { api } from "@/lib/browser-api";
import { parseCaptureHash } from "@/lib/import-captured";

export function CaptureFromDevice() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    async function run() {
      try {
        const captured = parseCaptureHash(window.location.hash);
        const recipe = await api<RecipeDetails>("/api/v1/recipes/import/page", {
          method: "POST",
          body: JSON.stringify(captured),
        });
        window.sessionStorage.setItem(
          "ovenlovin.import-toast",
          JSON.stringify({ title: recipe.title, servings: recipe.servings ?? 4 })
        );
        router.replace(`/recipes/${recipe.id}`);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not import recipe");
      }
    }

    void run();
    // One shot when the bookmarklet lands on this page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="form-card">
      <h1>Save from this page</h1>
      {error ? (
        <>
          <p className="muted import-error">{error}</p>
          <p className="muted">
            Stay signed in to OvenLovin, then tap Save to OvenLovin on the recipe page again.
          </p>
          <p>
            <Link className="btn" href="/recipes">
              Back to recipes
            </Link>
          </p>
        </>
      ) : (
        <p className="muted">Saving the recipe from your browser...</p>
      )}
    </div>
  );
}
