"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { BookSettings, BookSettingsInput } from "@ovenlovin/core/book";
import { api } from "@/lib/browser-api";
import { BottomSheet } from "./BottomSheet";

export type BookRecipeChoice = { id: string; title: string; image: string | null };

/** "auto" is the house default: the first recipe with a photo. */
export type CoverChoice = "auto" | "type" | string;

export function coverChoiceOf(settings: BookSettings): CoverChoice {
  if (settings.cover?.kind === "type") return "type";
  if (settings.cover?.kind === "recipe") return settings.cover.recipeId;
  return "auto";
}

/** The sheet's draft to the PATCH body. Pure, for tests. */
export function bookSettingsBody(draft: {
  cover: CoverChoice;
  title: string;
  subtitle: string;
  dedication: string;
  includeCards: boolean;
}): BookSettingsInput {
  return {
    ...(draft.cover === "type" ? { cover: { kind: "type" as const } } : {}),
    ...(draft.cover !== "type" && draft.cover !== "auto"
      ? { cover: { kind: "recipe" as const, recipeId: draft.cover } }
      : {}),
    title: draft.title,
    subtitle: draft.subtitle,
    dedication: draft.dedication,
    ...(draft.includeCards ? {} : { includeCards: false }),
  };
}

export function moveId(ids: string[], id: string, delta: number) {
  const from = ids.indexOf(id);
  const to = from + delta;
  if (from < 0 || to < 0 || to >= ids.length) return ids;
  const next = [...ids];
  next.splice(to, 0, ...next.splice(from, 1));
  return next;
}

/**
 * "Make it yours": cover, title, subtitle, dedication, original cards, and
 * recipe order. Saves through the cookbook PATCH, then the reader re-lays the
 * book from the same page model the PDF prints.
 */
export function BookSettingsSheet({
  bookId,
  name,
  settings,
  recipes,
  open,
  onClose,
}: {
  bookId: string;
  name: string;
  settings: BookSettings;
  recipes: BookRecipeChoice[];
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [cover, setCover] = useState<CoverChoice>("auto");
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [dedication, setDedication] = useState("");
  const [includeCards, setIncludeCards] = useState(true);
  const [order, setOrder] = useState<string[]>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fresh draft each time the sheet opens; depends on `open` only.
  useEffect(() => {
    if (!open) return;
    setCover(coverChoiceOf(settings));
    setTitle(settings.title ?? "");
    setSubtitle(settings.subtitle ?? "");
    setDedication(settings.dedication ?? "");
    setIncludeCards(settings.includeCards !== false);
    setOrder(recipes.map((recipe) => recipe.id));
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const byId = new Map(recipes.map((recipe) => [recipe.id, recipe]));
  const photos = recipes.filter((recipe) => recipe.image);
  const reordered = order.join() !== recipes.map((recipe) => recipe.id).join();

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      await api(`/api/v1/cookbooks/${bookId}`, {
        method: "PATCH",
        body: JSON.stringify({
          bookSettings: bookSettingsBody({ cover, title, subtitle, dedication, includeCards }),
          ...(reordered ? { recipeOrder: order } : {}),
        }),
      });
      onClose();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the book. Try again.");
    } finally {
      setPending(false);
    }
  }

  const coverChoices = [
    { id: "auto", label: "First photo", image: photos[0]?.image ?? null },
    { id: "type", label: "Type only", image: null },
    ...photos.map((recipe) => ({ id: recipe.id, label: recipe.title, image: recipe.image })),
  ];

  return (
    <BottomSheet open={open} title="Make it yours" onClose={onClose}>
      <form className="form-card book-settings" style={{ margin: 0 }} onSubmit={save}>
        <label>
          Title
          <input
            value={title}
            maxLength={255}
            placeholder={name}
            onChange={(event) => setTitle(event.target.value)}
          />
        </label>
        <label>
          Subtitle
          <input
            value={subtitle}
            maxLength={255}
            placeholder="The family recipes"
            onChange={(event) => setSubtitle(event.target.value)}
          />
        </label>
        <label>
          Dedication
          <textarea
            value={dedication}
            maxLength={500}
            rows={2}
            placeholder="For Mom, Christmas 2026"
            onChange={(event) => setDedication(event.target.value)}
          />
        </label>

        <fieldset className="book-settings-group">
          <legend>Cover</legend>
          <div className="book-cover-choices" role="radiogroup" aria-label="Cover">
            {coverChoices.map((choice) => (
              <button
                key={choice.id}
                type="button"
                role="radio"
                aria-checked={cover === choice.id}
                className={`book-cover-choice${cover === choice.id ? " is-selected" : ""}`}
                onClick={() => setCover(choice.id)}
              >
                {choice.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={choice.image} alt="" />
                ) : (
                  <span className="book-cover-choice-type" aria-hidden="true">
                    Aa
                  </span>
                )}
                <span>{choice.label}</span>
              </button>
            ))}
          </div>
        </fieldset>

        <label className="book-settings-check">
          <input
            type="checkbox"
            checked={includeCards}
            onChange={(event) => setIncludeCards(event.target.checked)}
          />
          <span>
            Include original cards
            <span className="field-hint">
              Photos of handwritten cards print next to family recipes.
            </span>
          </span>
        </label>

        {order.length > 1 ? (
          <fieldset className="book-settings-group">
            <legend>Recipe order</legend>
            <p className="field-hint">
              Chapters follow each recipe&apos;s course. Inside a chapter, recipes keep this order.
            </p>
            <ol className="book-order">
              {order.map((id, i) => {
                const recipe = byId.get(id);
                if (!recipe) return null;
                return (
                  <li key={id} data-recipe-id={id}>
                    <span className="book-order-title">{recipe.title}</span>
                    <button
                      type="button"
                      className="btn book-order-move"
                      aria-label={`Move ${recipe.title} up`}
                      disabled={i === 0}
                      onClick={() => setOrder((ids) => moveId(ids, id, -1))}
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      className="btn book-order-move"
                      aria-label={`Move ${recipe.title} down`}
                      disabled={i === order.length - 1}
                      onClick={() => setOrder((ids) => moveId(ids, id, 1))}
                    >
                      ↓
                    </button>
                  </li>
                );
              })}
            </ol>
          </fieldset>
        ) : null}

        {error ? (
          <p className="muted import-error" role="alert">
            {error}
          </p>
        ) : null}
        <button className="btn primary" type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save book"}
        </button>
      </form>
    </BottomSheet>
  );
}
