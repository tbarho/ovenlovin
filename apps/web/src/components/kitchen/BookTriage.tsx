"use client";

import Link from "next/link";
import { useState } from "react";
import type { TriageRow } from "@ovenlovin/core/jobs";
import { api } from "@/lib/browser-api";
import type { BookContentsView } from "@/lib/book-import-view";
import {
  recipeCreateBodyFromReview,
  reviewDraftFromImportPreview,
  type PhotoReviewDraft,
} from "@/lib/photo-import-review";
import { BottomSheet } from "./BottomSheet";
import { ImportReviewForm } from "./PhotoImportDialog";

/** The review form's starting point: the parked draft, or just the title when the read failed. */
export function triageReviewDraft(row: TriageRow): PhotoReviewDraft {
  if (row.draft) return reviewDraftFromImportPreview(row.draft);
  return reviewDraftFromImportPreview({
    title: row.title,
    source: { type: "pdf", importerName: "pdf-importer", importerVersion: "0.1.0" } as any,
  });
}

const page = (row: TriageRow) => <span className="book-contents-page">p. {row.page}</span>;

export function BookTriage({
  view,
  onChange,
}: {
  view: BookContentsView;
  onChange: (next: BookContentsView) => void;
}) {
  const [open, setOpen] = useState<TriageRow | null>(null);
  const [review, setReview] = useState<PhotoReviewDraft | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { rows, summary, line } = view.triage;
  const ready = rows.filter((row) => row.state === "ready");
  const flagged = rows.filter((row) => row.state === "needs_look");
  const saved = rows.filter((row) => row.state === "saved");

  async function save(items: { candidateId: string; reviewed?: unknown }[]) {
    setPending(true);
    setError(null);
    try {
      const result = await api<{ view: BookContentsView }>(
        `/api/v1/books/imports/${view.jobId}/recipes`,
        { method: "POST", keepalive: false, body: JSON.stringify({ items }) }
      );
      onChange(result.view);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save. Try again.");
      return false;
    } finally {
      setPending(false);
    }
  }

  function openReview(row: TriageRow) {
    setError(null);
    setOpen(row);
    setReview(triageReviewDraft(row));
  }

  function close() {
    setOpen(null);
    setReview(null);
  }

  async function saveReview(event: React.FormEvent) {
    event.preventDefault();
    if (!open || !review) return;
    const done = await save([
      { candidateId: open.candidateId, reviewed: recipeCreateBodyFromReview(review) },
    ]);
    if (done) close();
  }

  return (
    <div className="book-triage">
      <p className="sheet-lead" role="status" aria-live="polite">
        {line}.
        {summary.needsLook > 0
          ? ` ${summary.needsLook} ${summary.needsLook === 1 ? "needs" : "need"} a look.`
          : null}
      </p>

      {summary.pulling > 0 ? (
        <div
          className="photo-import-meter"
          role="progressbar"
          aria-label="Recipes read"
          aria-valuemin={0}
          aria-valuemax={summary.total}
          aria-valuenow={summary.total - summary.pulling}
        >
          <span
            style={{ width: `${((summary.total - summary.pulling) / summary.total) * 100}%` }}
          />
        </div>
      ) : null}

      {error && !open ? (
        <p className="muted import-error" role="alert">
          {error}
        </p>
      ) : null}

      {ready.length > 0 ? (
        <section className="book-contents-group" aria-label="Ready">
          <h2>Ready</h2>
          <ul className="recipe-pick-list">
            {ready.map((row) => (
              <li key={row.candidateId} className="book-contents-row book-triage-row">
                <span>{row.title}</span>
                {page(row)}
              </li>
            ))}
          </ul>
          <button
            className="btn primary"
            type="button"
            disabled={pending}
            onClick={() => save(ready.map((row) => ({ candidateId: row.candidateId })))}
          >
            {pending
              ? "Saving"
              : `Save ${ready.length} ready ${ready.length === 1 ? "recipe" : "recipes"}`}
          </button>
        </section>
      ) : null}

      {flagged.length > 0 ? (
        <section className="book-contents-group" aria-label="Needs a look">
          <h2>Needs a look</h2>
          <ul className="recipe-pick-list">
            {flagged.map((row) => (
              <li key={row.candidateId} className="book-contents-row book-triage-row">
                <span>
                  {row.title}
                  <span className="muted book-triage-reason">{row.reasons.join(" ")}</span>
                </span>
                {page(row)}
                <button className="btn compact" type="button" onClick={() => openReview(row)}>
                  Review
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {saved.length > 0 ? (
        <section className="book-contents-group" aria-label="Saved">
          <h2>Saved</h2>
          <ul className="recipe-pick-list">
            {saved.map((row) => (
              <li key={row.candidateId} className="book-contents-row book-triage-row">
                <Link href={`/recipes/${row.recipeId}`}>{row.title}</Link>
                {page(row)}
              </li>
            ))}
          </ul>
          {view.cookbookId ? (
            <Link className="btn" href={`/recipes?cookbook=${view.cookbookId}`}>
              Open the cookbook
            </Link>
          ) : null}
        </section>
      ) : null}

      <BottomSheet open={Boolean(open)} title="Review recipe" onClose={close}>
        {open && review ? (
          <ImportReviewForm
            draft={review}
            heroSrc={open.draft?.images?.[0] ?? null}
            pending={pending}
            error={error}
            existingRecipeUrl={null}
            possibleDuplicate={open.duplicate}
            savedRecipeId={null}
            showPhotoChrome={false}
            notice={open.reasons.join(" ") || null}
            onOpenSaved={() => undefined}
            onChange={setReview}
            onSave={saveReview}
          />
        ) : null}
      </BottomSheet>
    </div>
  );
}
