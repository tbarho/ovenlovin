"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/browser-api";
import type { PhotoImportPreview } from "@/lib/photo-import";
import {
  recipeCreateBodyFromReview,
  reviewDraftFromPreview,
  type PhotoReviewDraft,
} from "@/lib/photo-import-review";
import { BottomSheet } from "./BottomSheet";

async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error("Could not read that photo"));
    reader.readAsDataURL(file);
  });
}

async function extractFromFiles(files: File[]): Promise<PhotoImportPreview> {
  const data = new FormData();
  for (const file of files) {
    data.append("image", file);
  }
  const response = await fetch("/api/v1/recipes/import/photo", {
    method: "POST",
    credentials: "include",
    body: data,
  });
  if (!response.ok) {
    const problem = (await response.json().catch(() => ({ title: response.statusText }))) as {
      detail?: string;
      title?: string;
    };
    throw new Error(problem.detail || problem.title || "Could not read that photo");
  }
  return (await response.json()) as PhotoImportPreview;
}

function PhotoReviewForm({
  draft,
  heroSrc,
  pending,
  error,
  onChange,
  onSave,
}: {
  draft: PhotoReviewDraft;
  heroSrc: string | null;
  pending: boolean;
  error: string | null;
  onChange: (next: PhotoReviewDraft) => void;
  onSave: (event: React.FormEvent) => void;
}) {
  return (
    <form className="form-card photo-review-form" style={{ margin: 0 }} onSubmit={onSave}>
      {draft.uncertainFields.length > 0 ? (
        <p className="import-warn" role="status">
          This photo was hard to read. Check {draft.uncertainFields.join(", ")}.
        </p>
      ) : (
        <p className="sheet-lead">
          Fix anything that looks off, then save. One main photo is kept.
        </p>
      )}
      {heroSrc ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img className="photo-review-hero" src={heroSrc} alt="" />
      ) : null}
      <label>
        Title
        <input
          value={draft.title}
          onChange={(event) => onChange({ ...draft, title: event.target.value })}
          required
        />
      </label>
      <div className="photo-review-meta">
        <label>
          Servings
          <input
            type="number"
            min={1}
            value={draft.servings}
            onChange={(event) => onChange({ ...draft, servings: event.target.value })}
          />
        </label>
        <label>
          Prep (min)
          <input
            type="number"
            min={0}
            value={draft.prepTimeMinutes}
            onChange={(event) => onChange({ ...draft, prepTimeMinutes: event.target.value })}
          />
        </label>
        <label>
          Cook (min)
          <input
            type="number"
            min={0}
            value={draft.cookTimeMinutes}
            onChange={(event) => onChange({ ...draft, cookTimeMinutes: event.target.value })}
          />
        </label>
      </div>
      <label>
        Notes
        <textarea
          rows={2}
          value={draft.notes}
          onChange={(event) => onChange({ ...draft, notes: event.target.value })}
        />
      </label>
      <label>
        Source
        <input
          value={draft.sourceAttribution}
          onChange={(event) => onChange({ ...draft, sourceAttribution: event.target.value })}
          placeholder="Cookbook, author, or URL if you saw one"
        />
      </label>
      <label>
        Ingredients
        <textarea
          rows={6}
          value={draft.ingredientsText}
          onChange={(event) => onChange({ ...draft, ingredientsText: event.target.value })}
          required
        />
      </label>
      <label>
        Steps
        <textarea
          rows={6}
          value={draft.stepsText}
          onChange={(event) => onChange({ ...draft, stepsText: event.target.value })}
          required
        />
      </label>
      {error ? <p className="muted">{error}</p> : null}
      <button className="btn primary" type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save recipe"}
      </button>
    </form>
  );
}

export function PhotoImportDialog({
  open,
  files,
  onClose,
}: {
  open: boolean;
  files: File[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [phase, setPhase] = useState<"reading" | "review" | "error">("reading");
  const [draft, setDraft] = useState<PhotoReviewDraft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [localHero, setLocalHero] = useState<string | null>(null);
  const extractedKey = useRef<string | null>(null);

  useEffect(() => {
    const file = files[0];
    if (!open || !file) {
      setLocalHero(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setLocalHero(url);
    return () => URL.revokeObjectURL(url);
  }, [open, files]);

  useEffect(() => {
    if (!open) {
      extractedKey.current = null;
      setDraft(null);
      setPhase("reading");
      setError(null);
      setPending(false);
      return;
    }

    const key = files.map((file) => `${file.name}:${file.size}:${file.lastModified}`).join("|");
    if (!key || extractedKey.current === key) return;
    extractedKey.current = key;

    let cancelled = false;
    setPhase("reading");
    setError(null);
    void extractFromFiles(files)
      .then((preview) => {
        if (cancelled) return;
        setDraft(reviewDraftFromPreview(preview));
        setPhase("review");
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Could not read that photo");
        setPhase("error");
      });

    return () => {
      cancelled = true;
    };
  }, [open, files]);

  async function saveReview(event: React.FormEvent) {
    event.preventDefault();
    if (!draft) return;
    setPending(true);
    setError(null);
    try {
      const body = recipeCreateBodyFromReview(draft);
      if ((!body.images || body.images.length === 0) && files[0]) {
        body.images = [await fileToDataUrl(files[0])];
      }
      const recipe = await api<{ id: string }>("/api/v1/recipes", {
        method: "POST",
        body: JSON.stringify(body),
      });
      onClose();
      router.push(`/recipes/${recipe.id}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save recipe");
      setPending(false);
    }
  }

  return (
    <BottomSheet open={open} title="Import from photo" onClose={onClose}>
      {phase === "reading" ? (
        <p className="sheet-lead" role="status">
          Reading the recipe…
        </p>
      ) : null}
      {phase === "error" ? <p className="import-warn">{error}</p> : null}
      {phase === "review" && draft ? (
        <PhotoReviewForm
          draft={draft}
          heroSrc={draft.images[0] || localHero}
          pending={pending}
          error={error}
          onChange={setDraft}
          onSave={saveReview}
        />
      ) : null}
    </BottomSheet>
  );
}
