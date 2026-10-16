"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/browser-api";
import {
  PHOTO_IMPORT_ESTIMATE,
  PHOTO_IMPORT_STEPS,
  compressPhotoForSave,
  photoImportAnnouncement,
  photoImportStepReached,
  uploadingStepLabel,
  type PhotoImportPhase,
} from "@/lib/photo-import-client";
import {
  cancelPhotoImportJob,
  retryPhotoImportJob,
  subscribePhotoImportJob,
  type PhotoImportJobSnapshot,
} from "@/lib/photo-import-job";
import {
  isUncertainReviewField,
  recipeCreateBodyFromReview,
  reviewDraftFromPreview,
  type PhotoReviewDraft,
} from "@/lib/photo-import-review";
import { BottomSheet } from "./BottomSheet";

function stepLabel(stepId: (typeof PHOTO_IMPORT_STEPS)[number]["id"], percent: number): string {
  if (stepId === "uploading") return uploadingStepLabel(percent);
  return PHOTO_IMPORT_STEPS.find((step) => step.id === stepId)?.label ?? stepId;
}

function PhotoImportProgress({
  phase,
  percent,
  previewUrl,
}: {
  phase: Extract<PhotoImportPhase, "uploading" | "reading">;
  percent: number;
  previewUrl: string | null;
}) {
  const announcement = photoImportAnnouncement(phase, percent);
  return (
    <div className="sheet-stack">
      {previewUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img className="photo-review-hero" src={previewUrl} alt="Selected recipe photo" />
      ) : null}
      <ol className="sheet-steps">
        {PHOTO_IMPORT_STEPS.map((step) => (
          <li
            key={step.id}
            className={photoImportStepReached(step.id, phase) ? "is-current" : undefined}
          >
            {stepLabel(step.id, percent)}
          </li>
        ))}
      </ol>
      <div
        className="photo-import-meter"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={phase === "uploading" ? percent : 100}
        aria-label={phase === "uploading" ? "Upload" : "Reading"}
      >
        <span style={{ width: `${phase === "uploading" ? percent : 100}%` }} />
      </div>
      <p className="sheet-lead">{PHOTO_IMPORT_ESTIMATE}.</p>
      <p className="sr-only" role="status" aria-live="polite">
        {announcement}
      </p>
    </div>
  );
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
  const uncertain = draft.uncertainFields;
  return (
    <form className="form-card photo-review-form" style={{ margin: 0 }} onSubmit={onSave}>
      <ol className="sheet-steps">
        {PHOTO_IMPORT_STEPS.map((step) => (
          <li key={step.id} className="is-current">
            {step.label}
          </li>
        ))}
      </ol>
      {uncertain.length > 0 ? (
        <p className="import-warn" role="status" aria-live="polite">
          Ready to review. This photo was hard to read. Check {uncertain.join(", ")}.
        </p>
      ) : (
        <p className="sheet-lead" role="status" aria-live="polite">
          Ready to review. Fix anything that looks off, then save. One main photo is kept.
        </p>
      )}
      {heroSrc ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img className="photo-review-hero" src={heroSrc} alt="Selected recipe photo" />
      ) : null}
      <label className={isUncertainReviewField(uncertain, "title") ? "is-uncertain" : undefined}>
        Title
        <input
          value={draft.title}
          onChange={(event) => onChange({ ...draft, title: event.target.value })}
          required
        />
      </label>
      <div className="photo-review-meta">
        <label
          className={isUncertainReviewField(uncertain, "servings") ? "is-uncertain" : undefined}
        >
          Servings
          <input
            type="number"
            min={1}
            value={draft.servings}
            onChange={(event) => onChange({ ...draft, servings: event.target.value })}
          />
        </label>
        <label className={isUncertainReviewField(uncertain, "times") ? "is-uncertain" : undefined}>
          Prep (min)
          <input
            type="number"
            min={0}
            value={draft.prepTimeMinutes}
            onChange={(event) => onChange({ ...draft, prepTimeMinutes: event.target.value })}
          />
        </label>
        <label className={isUncertainReviewField(uncertain, "times") ? "is-uncertain" : undefined}>
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
      <label
        className={isUncertainReviewField(uncertain, "ingredients") ? "is-uncertain" : undefined}
      >
        Ingredients
        <textarea
          rows={6}
          value={draft.ingredientsText}
          onChange={(event) => onChange({ ...draft, ingredientsText: event.target.value })}
          required
        />
      </label>
      <label className={isUncertainReviewField(uncertain, "steps") ? "is-uncertain" : undefined}>
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
  onClose,
  onTypeOrPaste,
}: {
  open: boolean;
  onClose: () => void;
  onTypeOrPaste: () => void;
}) {
  const router = useRouter();
  const [job, setJob] = useState<PhotoImportJobSnapshot | null>(null);
  const [draft, setDraft] = useState<PhotoReviewDraft | null>(null);
  const [pending, setPending] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => subscribePhotoImportJob(setJob), []);

  useEffect(() => {
    if (job?.phase === "review" && job.preview) {
      setDraft(reviewDraftFromPreview(job.preview));
      setSaveError(null);
    }
    if (job?.phase !== "review") setDraft(null);
  }, [job]);

  function cancelImport() {
    cancelPhotoImportJob();
    onClose();
  }

  async function saveReview(event: React.FormEvent) {
    event.preventDefault();
    if (!draft || !job) return;
    setPending(true);
    setSaveError(null);
    try {
      const body = recipeCreateBodyFromReview(draft);
      const recipe = await api<{ id: string }>("/api/v1/recipes", {
        method: "POST",
        body: JSON.stringify(body),
      });
      if ((!body.images || body.images.length === 0) && job.files[0]) {
        const image = await compressPhotoForSave(job.files[0]);
        await api(`/api/v1/recipes/${recipe.id}/image`, {
          method: "POST",
          body: JSON.stringify({ image }),
        });
      }
      cancelPhotoImportJob();
      onClose();
      router.push(`/recipes/${recipe.id}`);
      router.refresh();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Could not save recipe");
      setPending(false);
    }
  }

  const phase = job?.phase ?? "uploading";

  return (
    <BottomSheet open={open} title="Import from photo" onClose={onClose}>
      {phase === "uploading" || phase === "reading" ? (
        <>
          <PhotoImportProgress
            phase={phase}
            percent={job?.percent ?? 0}
            previewUrl={job?.previewUrl ?? null}
          />
          <div className="sheet-actions">
            <button type="button" className="btn compact" onClick={cancelImport}>
              Cancel
            </button>
          </div>
        </>
      ) : null}
      {phase === "error" ? (
        <div className="sheet-stack">
          {job?.previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img className="photo-review-hero" src={job.previewUrl} alt="Selected recipe photo" />
          ) : null}
          <p className="import-warn" role="status" aria-live="polite">
            {job?.errorMessage}
          </p>
          <div className="sheet-actions photo-import-error-actions">
            <button type="button" className="btn compact" onClick={onTypeOrPaste}>
              Type or paste instead
            </button>
            <button type="button" className="btn compact" onClick={cancelImport}>
              Cancel
            </button>
            <button
              type="button"
              className="btn primary compact"
              onClick={() => retryPhotoImportJob()}
            >
              Retry
            </button>
          </div>
        </div>
      ) : null}
      {phase === "review" && draft ? (
        <PhotoReviewForm
          draft={draft}
          heroSrc={
            job?.previewUrl ||
            (draft.images[0]?.startsWith("data:") || draft.images[0]?.startsWith("blob:")
              ? draft.images[0]
              : null) ||
            null
          }
          pending={pending}
          error={saveError}
          onChange={setDraft}
          onSave={saveReview}
        />
      ) : null}
    </BottomSheet>
  );
}
