"use client";

import { useEffect, useRef } from "react";
import {
  formatInstagramHandle,
  ingredientHasAmount,
  noAmountField,
  type InstagramNextStep,
  type InstagramPostKind,
} from "@ovenlovin/core/instagram";

export type ImportPreview = {
  title?: string;
  servings?: number;
  notes?: string;
  description?: string;
  ingredients?: { rawText?: string }[];
  steps?: { text?: string }[];
  images?: string[];
  needsReview?: boolean;
  uncertainFields?: string[];
  source?: {
    type?: string;
    author?: string;
    url?: string;
    canonicalUrl?: string;
    attribution?: string;
    importerName?: string;
    importerVersion?: string;
    rawExtractionJson?: Record<string, unknown>;
  };
};

export type IgRow = { key: string; text: string };

export type IgReviewState = {
  title: string;
  servings: number;
  creator: string;
  showCreator: boolean;
  ingredients: IgRow[];
  steps: IgRow[];
  caption: string;
  permalink: string;
  kind?: InstagramPostKind;
  coverUrl: string | null;
  useCover: boolean;
  noCoverNote: boolean;
  preview: ImportPreview;
};

export function InstagramMark() {
  return (
    <svg className="ig-mark" viewBox="0 0 24 24" aria-hidden="true">
      <rect
        x="3"
        y="3"
        width="18"
        height="18"
        rx="5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="17.2" cy="6.8" r="1" fill="currentColor" />
    </svg>
  );
}

export function isInstagramPreview(value: unknown): value is ImportPreview {
  if (!value || typeof value !== "object") return false;
  const source = (value as ImportPreview).source;
  return source?.type === "social" && source.rawExtractionJson?.sourcePlatform === "instagram";
}

function clampServings(value: number): number {
  if (!Number.isFinite(value)) return 2;
  return Math.min(24, Math.max(1, Math.round(value)));
}

export function igReviewFromPreview(preview: ImportPreview, nextKey: () => string): IgReviewState {
  const source = preview.source ?? {};
  const raw = source.rawExtractionJson ?? {};
  const handle = formatInstagramHandle(source.author);
  const images = Array.isArray(preview.images) ? preview.images : [];
  const coverStorable =
    raw.coverStorable === true && typeof images[0] === "string" && images[0].length > 0;
  const kind = raw.kind === "post" || raw.kind === "reel" ? raw.kind : undefined;
  const caption = typeof raw.caption === "string" ? raw.caption : "";
  return {
    title: typeof preview.title === "string" ? preview.title : "",
    servings: clampServings(typeof preview.servings === "number" ? preview.servings : 2),
    creator: handle || "@",
    showCreator: !handle,
    ingredients: (preview.ingredients ?? [])
      .map((item) => (typeof item.rawText === "string" ? item.rawText : ""))
      .filter((text) => text.trim())
      .map((text) => ({ key: nextKey(), text })),
    steps: (preview.steps ?? [])
      .map((item) => (typeof item.text === "string" ? item.text : ""))
      .filter((text) => text.trim())
      .map((text) => ({ key: nextKey(), text })),
    caption,
    permalink: source.canonicalUrl || source.url || "",
    kind,
    coverUrl: coverStorable ? images[0]! : null,
    useCover: coverStorable,
    noCoverNote: !coverStorable && typeof raw.coverUrl === "string" && raw.coverUrl.length > 0,
    preview,
  };
}

export function igDraftForSave(state: IgReviewState): ImportPreview {
  const handle = formatInstagramHandle(state.creator);
  const source = state.preview.source ?? {};
  const raw = source.rawExtractionJson ?? {};
  const ingredients = state.ingredients
    .map((row) => row.text.trim())
    .filter(Boolean)
    .map((rawText) => ({ rawText }));
  const steps = state.steps
    .map((row) => row.text.trim())
    .filter(Boolean)
    .map((text) => ({ text }));
  return {
    ...state.preview,
    title: state.title.trim(),
    servings: state.servings,
    ingredients,
    steps,
    images: state.useCover && state.coverUrl ? [state.coverUrl] : [],
    needsReview: true,
    uncertainFields: ingredients
      .filter((item) => !ingredientHasAmount(item.rawText))
      .map((item) => noAmountField(item.rawText)),
    source: {
      ...source,
      type: "social",
      author: handle || undefined,
      attribution: handle ? `${handle} on Instagram` : "Instagram",
      url: state.permalink || source.url,
      canonicalUrl: state.permalink || source.canonicalUrl,
      importerName: source.importerName || "instagram",
      importerVersion: source.importerVersion || "0.1.0",
      rawExtractionJson: {
        ...raw,
        sourcePlatform: "instagram",
        sourceName: handle || undefined,
        kind: state.kind,
        caption: state.caption,
      },
    },
  };
}

export function captionCreditLine(handle?: string): string {
  const name = formatInstagramHandle(handle);
  return name ? `We will still credit ${name}.` : "We will still credit the creator.";
}

export function InstagramErrorPanel({
  heading,
  message,
  nextSteps,
  onStep,
}: {
  heading: string;
  message: string;
  nextSteps: InstagramNextStep[];
  onStep: (id: InstagramNextStep["id"]) => void;
}) {
  return (
    <div className="import-error-screen" role="alert">
      <h3>{heading}</h3>
      <p>{message}</p>
      <div className="import-next">
        {nextSteps.map((step, index) => (
          <button
            key={step.id}
            type="button"
            className={index === 0 ? "btn primary import-next-btn" : "btn import-next-btn"}
            onClick={() => onStep(step.id)}
          >
            <span>{step.label}</span>
            {step.hint ? <span className="import-next-hint">{step.hint}</span> : null}
          </button>
        ))}
      </div>
    </div>
  );
}

export function CaptionPanel({
  value,
  handle,
  onChange,
  onRead,
  pending,
}: {
  value: string;
  handle?: string;
  onChange: (value: string) => void;
  onRead: () => void;
  pending: boolean;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    ref.current?.focus();
  }, []);
  return (
    <form
      className="import-caption"
      onSubmit={(event) => {
        event.preventDefault();
        onRead();
      }}
    >
      <h3>Paste the caption</h3>
      <p className="muted">
        We can&apos;t read Instagram links yet. In Instagram, tap the caption, then
        &quot;more&quot;, press and hold, then Copy. Paste it here. {captionCreditLine(handle)}
      </p>
      <label>
        Caption
        <textarea
          ref={ref}
          className="import-caption-box"
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
      </label>
      <button className="btn primary" type="submit" disabled={pending}>
        Read caption
      </button>
    </form>
  );
}

export function InstagramReview({
  state,
  pending,
  error,
  existingRecipeUrl,
  onChange,
  onSaveKitchen,
  onSaveCookbook,
  nextKey,
}: {
  state: IgReviewState;
  pending: boolean;
  error: string | null;
  existingRecipeUrl: string | null;
  onChange: (next: IgReviewState) => void;
  onSaveKitchen: () => void;
  onSaveCookbook: () => void;
  nextKey: () => string;
}) {
  const handle = formatInstagramHandle(state.creator);
  return (
    <div className="import-review">
      <h3>Review before saving</h3>
      <p className="muted">Check what we read</p>
      {state.coverUrl ? (
        <label className="check-row import-cover">
          <input
            type="checkbox"
            checked={state.useCover}
            onChange={(event) => onChange({ ...state, useCover: event.target.checked })}
          />
          Use this still as the cover
        </label>
      ) : null}
      {state.noCoverNote ? <p className="muted">No cover photo. You can add one later.</p> : null}
      {state.showCreator ? (
        <label>
          Creator
          <input
            value={state.creator}
            onChange={(event) => onChange({ ...state, creator: event.target.value })}
            aria-label="Creator"
          />
        </label>
      ) : (
        <p className="import-source">
          <InstagramMark />
          {state.permalink ? (
            <a href={state.permalink} target="_blank" rel="noreferrer">
              From {handle} on Instagram
            </a>
          ) : (
            <span>From {handle} on Instagram</span>
          )}
          <span className="muted"> · credited on the recipe</span>
        </p>
      )}
      <label>
        Title
        <input
          value={state.title}
          aria-label="Title"
          onChange={(event) => onChange({ ...state, title: event.target.value })}
        />
      </label>
      <div className="import-serves">
        <span>Serves</span>
        <button
          type="button"
          className="btn compact"
          aria-label="Fewer servings"
          onClick={() => onChange({ ...state, servings: clampServings(state.servings - 1) })}
        >
          −
        </button>
        <span aria-live="polite">{state.servings}</span>
        <button
          type="button"
          className="btn compact"
          aria-label="More servings"
          onClick={() => onChange({ ...state, servings: clampServings(state.servings + 1) })}
        >
          +
        </button>
      </div>
      <div className="import-section">
        <div className="import-section-head">
          <h4>Ingredients ({state.ingredients.length})</h4>
          <button
            type="button"
            className="btn compact"
            onClick={() =>
              onChange({
                ...state,
                ingredients: [...state.ingredients, { key: nextKey(), text: "" }],
              })
            }
          >
            + Add
          </button>
        </div>
        <ul className="import-rows">
          {state.ingredients.map((row) => (
            <li key={row.key} className="import-ing">
              <input
                aria-label="Ingredient"
                value={row.text}
                onChange={(event) =>
                  onChange({
                    ...state,
                    ingredients: state.ingredients.map((item) =>
                      item.key === row.key ? { ...item, text: event.target.value } : item
                    ),
                  })
                }
              />
              <button
                type="button"
                className="btn compact"
                aria-label={row.text.trim() ? `Remove ${row.text.trim()}` : "Remove ingredient"}
                onClick={() =>
                  onChange({
                    ...state,
                    ingredients: state.ingredients.filter((item) => item.key !== row.key),
                  })
                }
              >
                ×
              </button>
              {row.text.trim() && !ingredientHasAmount(row.text) ? (
                <span className="import-chip">
                  No amount in the caption. Add one if you know it.
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      </div>
      <div className="import-section">
        <div className="import-section-head">
          <h4>Steps</h4>
          <button
            type="button"
            className="btn compact"
            onClick={() =>
              onChange({
                ...state,
                steps: [...state.steps, { key: nextKey(), text: "" }],
              })
            }
          >
            + Add
          </button>
        </div>
        <ol className="import-rows">
          {state.steps.map((row, index) => (
            <li key={row.key} className="import-step-row">
              <span className="import-step-num">{index + 1}</span>
              <textarea
                className="import-step"
                aria-label={`Step ${index + 1}`}
                value={row.text}
                onChange={(event) =>
                  onChange({
                    ...state,
                    steps: state.steps.map((item) =>
                      item.key === row.key ? { ...item, text: event.target.value } : item
                    ),
                  })
                }
              />
            </li>
          ))}
        </ol>
      </div>
      {state.caption ? (
        <details className="import-caption-read">
          <summary>Show the caption we read</summary>
          <pre>{state.caption}</pre>
        </details>
      ) : null}
      {error ? (
        <p className="import-warn">
          {error}
          {existingRecipeUrl ? (
            <>
              {" "}
              <a href={existingRecipeUrl}>Open that recipe</a>
            </>
          ) : null}
        </p>
      ) : null}
      <div className="import-savebar">
        <button type="button" className="btn" onClick={onSaveCookbook} disabled={pending}>
          Save to cookbook
        </button>
        <button type="button" className="btn primary" onClick={onSaveKitchen} disabled={pending}>
          {pending ? "Saving…" : "Save to kitchen"}
        </button>
      </div>
    </div>
  );
}

export function InstagramSaved({
  title,
  handle,
  servings,
  ingredientCount,
  cookbookName,
  onAnother,
  onBack,
}: {
  title: string;
  handle: string;
  servings: number;
  ingredientCount: number;
  cookbookName: string | null;
  onAnother: () => void;
  onBack: () => void;
}) {
  const credit = formatInstagramHandle(handle);
  return (
    <div className="import-saved">
      <div className="import-done-mark" aria-hidden="true">
        ✓
      </div>
      <h3>{cookbookName ? `Saved to ${cookbookName}` : "Saved to your kitchen"}</h3>
      <p className="muted">
        Your household&apos;s can&apos;t-eat rules now check it like any other recipe.
      </p>
      <div className="import-saved-card">
        <strong>{title}</strong>
        {credit ? <p>From {credit} on Instagram</p> : <p>From Instagram</p>}
        <p className="muted">
          Serves {servings} · {ingredientCount}{" "}
          {ingredientCount === 1 ? "ingredient" : "ingredients"}
        </p>
      </div>
      <button type="button" className="btn primary" onClick={onAnother}>
        Import another
      </button>
      <button type="button" className="btn" onClick={onBack}>
        Back to recipes
      </button>
    </div>
  );
}

export function CookbookPickList({
  cookbooks,
  pending,
  onSave,
}: {
  cookbooks: { id: string; name: string }[];
  pending: boolean;
  onSave: (cookbook: { id: string; name: string }) => void;
}) {
  if (cookbooks.length === 0) {
    return <p className="muted">No cookbooks yet. Save to your kitchen, then make a cookbook.</p>;
  }
  return (
    <div className="import-cookbooks">
      <p className="muted">It also lands in your kitchen.</p>
      {cookbooks.map((cookbook) => (
        <button
          key={cookbook.id}
          type="button"
          className="btn"
          disabled={pending}
          onClick={() => onSave(cookbook)}
        >
          Save to {cookbook.name}
        </button>
      ))}
    </div>
  );
}
