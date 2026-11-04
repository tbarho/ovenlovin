"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { IMPORT_AI_UNAVAILABLE_MESSAGE } from "@ovenlovin/core/import-ai-unavailable";
import { Button, Field, Hint, Input, Textarea } from "@/components/ui";
import { api, apiErrorRecipeUrl } from "@/lib/browser-api";
import {
  PHOTO_IMPORT_REPLACE_EDITS,
  PHOTO_IMPORT_SHARPER,
  PHOTO_IMPORT_STEPS,
  PHOTO_SAVE_NO_IMAGE_MESSAGE,
  compressPhotoForSave,
  elapsedLabel,
  photoCopyForPages,
  photoImportAnnouncement,
  photoImportLead,
  photoImportStepState,
  photoPageLabel,
  readingStepLabel,
  shouldOfferSharperRead,
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
  isReviewDraftEdited,
  isUncertainReviewField,
  recipeCreateBodyFromReview,
  reviewDraftFromPreview,
  uncertainFieldNote,
  type PhotoReviewDraft,
} from "@/lib/photo-import-review";
import { BottomSheet } from "./BottomSheet";

function stepLabel(stepId: (typeof PHOTO_IMPORT_STEPS)[number]["id"], percent: number): string {
  if (stepId === "uploading") return uploadingStepLabel(percent);
  return PHOTO_IMPORT_STEPS.find((step) => step.id === stepId)?.label ?? stepId;
}

function reviewLead(photo: boolean, pages: number): string {
  if (photo && pages > 1) {
    return `Ready to review. Read from ${pages} pages. Page 1 is kept as the recipe photo.`;
  }
  if (photo)
    return "Ready to review. Fix anything that looks off, then save. One main photo is kept.";
  return "Ready to review. Fix anything that looks off, then save.";
}

const STEP_CLASS = { done: "is-done", current: "is-current", todo: undefined };

function useElapsed(phase: PhotoImportPhase, readingStartedAt: number | null) {
  const [fallbackStart, setFallbackStart] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (phase !== "reading") return;
    setFallbackStart((current) => current ?? Date.now());
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [phase]);
  const started = readingStartedAt ?? fallbackStart ?? now;
  return Math.max(0, now - started);
}

/** One hero for a single photo, a numbered strip for several pages. */
export function PhotoPages({ urls }: { urls: string[] }) {
  if (urls.length === 0) return null;
  if (urls.length === 1) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img className="photo-review-hero" src={urls[0]} alt="Selected recipe photo" />;
  }
  return (
    <ol className="photo-page-strip" aria-label={`${urls.length} pages`}>
      {urls.map((url, index) => (
        <li key={`${index}-${url}`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={url} alt={`Recipe ${photoPageLabel(index).toLowerCase()}`} />
          <span>{index + 1}</span>
        </li>
      ))}
    </ol>
  );
}

export function PhotoImportProgress({
  phase,
  percent,
  previewUrls,
  readingStartedAt = null,
  pages = 1,
  enhanced = false,
}: {
  phase: Extract<PhotoImportPhase, "uploading" | "reading">;
  percent: number;
  previewUrls: string[];
  readingStartedAt?: number | null;
  pages?: number;
  enhanced?: boolean;
}) {
  const elapsedMs = useElapsed(phase, readingStartedAt);
  const reading = phase === "reading";
  return (
    <div className="sheet-stack">
      <PhotoPages urls={previewUrls} />
      <ol className="sheet-steps">
        {PHOTO_IMPORT_STEPS.map((step) => (
          <li key={step.id} className={STEP_CLASS[photoImportStepState(step.id, phase)]}>
            {stepLabel(step.id, percent)}
          </li>
        ))}
      </ol>
      {reading ? (
        <div
          className="photo-import-meter is-indeterminate"
          role="progressbar"
          aria-label="Reading"
        >
          <span />
        </div>
      ) : (
        <div
          className="photo-import-meter"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent}
          aria-label="Upload"
        >
          <span style={{ width: `${percent}%` }} />
        </div>
      )}
      {reading ? (
        <p className="photo-import-timer">
          {readingStepLabel(pages, enhanced)} - {elapsedLabel(elapsedMs)}
        </p>
      ) : null}
      <p className="sheet-lead">{photoImportLead(reading ? elapsedMs : 0)}</p>
      <p className="sr-only" role="status" aria-live="polite">
        {photoImportAnnouncement(phase, { elapsedMs, pages, enhanced })}
      </p>
    </div>
  );
}

export function ImportReviewForm({
  draft,
  heroSrc,
  pending,
  error,
  existingRecipeUrl,
  possibleDuplicate,
  savedRecipeId,
  showPhotoChrome = true,
  pages = 1,
  notice = null,
  replacePrompt = null,
  onSharperRead,
  onOpenSaved,
  onChange,
  onSave,
}: {
  draft: PhotoReviewDraft;
  heroSrc: string | null;
  pending: boolean;
  error: string | null;
  existingRecipeUrl: string | null;
  possibleDuplicate: { recipeId: string; title: string } | null;
  savedRecipeId: string | null;
  showPhotoChrome?: boolean;
  pages?: number;
  notice?: string | null;
  replacePrompt?: { onReplace: () => void; onKeep: () => void } | null;
  onSharperRead?: () => void;
  onOpenSaved: () => void;
  onChange: (next: PhotoReviewDraft) => void;
  onSave: (event: React.FormEvent) => void;
}) {
  const uncertain = draft.uncertainFields;
  const titleNote = uncertainFieldNote(uncertain, "title");
  const servingsNote = uncertainFieldNote(uncertain, "servings");
  const timesNote = uncertainFieldNote(uncertain, "times");
  const ingredientsNote = uncertainFieldNote(uncertain, "ingredients");
  const stepsNote = uncertainFieldNote(uncertain, "steps");
  return (
    <form
      className="form-card photo-review-form"
      style={{ margin: 0 }}
      onSubmit={(event) => {
        if (!draft.ingredientsText.split(/\r?\n/).some((line) => line.trim())) {
          event.preventDefault();
          const box = event.currentTarget.querySelector<HTMLTextAreaElement>("#review-ingredients");
          box?.setCustomValidity("Add at least one ingredient");
          box?.reportValidity();
          return;
        }
        onSave(event);
      }}
    >
      {showPhotoChrome ? (
        <ol className="sheet-steps">
          {PHOTO_IMPORT_STEPS.map((step) => (
            <li key={step.id} className="is-done">
              {step.label}
            </li>
          ))}
        </ol>
      ) : null}
      {possibleDuplicate ? (
        <p className="import-warn">
          Similar to{" "}
          <a href={`/recipes/${possibleDuplicate.recipeId}`}>{possibleDuplicate.title}</a>. Saving
          will keep both recipes.
        </p>
      ) : null}
      {replacePrompt ? (
        <div className="import-warn photo-sharper" role="group" aria-label="New read">
          <span>{PHOTO_IMPORT_REPLACE_EDITS}</span>
          <Button type="button" size="sm" onClick={replacePrompt.onReplace}>
            Replace
          </Button>
          <Button type="button" variant="tertiary" size="sm" onClick={replacePrompt.onKeep}>
            Keep mine
          </Button>
        </div>
      ) : null}
      {notice ? (
        <p className="import-warn" role="status" aria-live="polite">
          {notice}
        </p>
      ) : uncertain.length > 0 ? (
        <div className="import-warn photo-sharper">
          <span role="status" aria-live="polite">
            {photoCopyForPages("Ready to review. This photo was hard to read.", pages)} Check{" "}
            {uncertain.join(", ")}.
          </span>
          {onSharperRead ? (
            <Button type="button" variant="tertiary" size="sm" onClick={onSharperRead}>
              {PHOTO_IMPORT_SHARPER}
            </Button>
          ) : null}
        </div>
      ) : (
        <p className="sheet-lead" role="status" aria-live="polite">
          {reviewLead(showPhotoChrome, pages)}
        </p>
      )}
      {heroSrc ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img className="photo-review-hero" src={heroSrc} alt="Selected recipe photo" />
      ) : null}
      <Field
        label="Title"
        className={isUncertainReviewField(uncertain, "title") ? "is-uncertain" : undefined}
        hint={titleNote}
      >
        <Input
          value={draft.title}
          onChange={(event) => onChange({ ...draft, title: event.target.value })}
          required
        />
      </Field>
      <div className="photo-review-meta">
        <Field
          label="Servings"
          className={isUncertainReviewField(uncertain, "servings") ? "is-uncertain" : undefined}
          hint={servingsNote}
        >
          <Input
            type="number"
            min={1}
            value={draft.servings}
            onChange={(event) => onChange({ ...draft, servings: event.target.value })}
          />
        </Field>
        <Field
          label="Prep (min)"
          className={isUncertainReviewField(uncertain, "times") ? "is-uncertain" : undefined}
          hint={timesNote}
        >
          <Input
            type="number"
            min={0}
            value={draft.prepTimeMinutes}
            onChange={(event) => onChange({ ...draft, prepTimeMinutes: event.target.value })}
          />
        </Field>
        <Field
          label="Cook (min)"
          className={isUncertainReviewField(uncertain, "times") ? "is-uncertain" : undefined}
          hint={timesNote}
        >
          <Input
            type="number"
            min={0}
            value={draft.cookTimeMinutes}
            onChange={(event) => onChange({ ...draft, cookTimeMinutes: event.target.value })}
          />
        </Field>
      </div>
      <Field label="Notes">
        <Textarea
          rows={2}
          value={draft.notes}
          onChange={(event) => onChange({ ...draft, notes: event.target.value })}
        />
      </Field>
      <Field label="Source">
        <Input
          value={draft.sourceAttribution}
          onChange={(event) => onChange({ ...draft, sourceAttribution: event.target.value })}
          placeholder="Cookbook, author, or URL if you saw one"
        />
      </Field>
      <Field
        label="Ingredients"
        className={isUncertainReviewField(uncertain, "ingredients") ? "is-uncertain" : undefined}
        hint={ingredientsNote}
      >
        <Textarea
          id="review-ingredients"
          rows={6}
          value={draft.ingredientsText}
          onChange={(event) => {
            event.currentTarget.setCustomValidity("");
            onChange({ ...draft, ingredientsText: event.target.value });
          }}
          required
        />
      </Field>
      <Field
        label="Steps"
        className={isUncertainReviewField(uncertain, "steps") ? "is-uncertain" : undefined}
        hint={stepsNote}
      >
        <Textarea
          rows={6}
          value={draft.stepsText}
          onChange={(event) => onChange({ ...draft, stepsText: event.target.value })}
        />
      </Field>
      {error ? (
        <Hint tone="error">
          {error}
          {existingRecipeUrl ? (
            <>
              {" "}
              <a href={existingRecipeUrl}>Open that recipe</a>
            </>
          ) : null}
        </Hint>
      ) : null}
      {pending ? (
        <p className="muted" role="status" aria-live="polite">
          Saving this recipe…
        </p>
      ) : null}
      {savedRecipeId ? (
        <Button type="button" onClick={onOpenSaved}>
          Open recipe
        </Button>
      ) : (
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save recipe"}
        </Button>
      )}
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
  const [existingRecipeUrl, setExistingRecipeUrl] = useState<string | null>(null);
  const [savedRecipe, setSavedRecipe] = useState<{
    id: string;
    title?: string;
    servings?: number;
  } | null>(null);
  const [mine, setMine] = useState<PhotoReviewDraft | null>(null);
  const saveKeyRef = useRef("");
  const keptRef = useRef<PhotoReviewDraft | null>(null);

  useEffect(() => subscribePhotoImportJob(setJob), []);

  useEffect(() => {
    if (job?.phase === "review" && job.preview) {
      const preview = job.preview;
      const kept = keptRef.current;
      keptRef.current = null;
      if (kept && !job.notice) setMine(kept);
      setDraft(
        (current) => current ?? (kept && job.notice ? kept : reviewDraftFromPreview(preview))
      );
    }
    if (job?.phase !== "review") {
      setDraft(null);
      setMine(null);
      setSavedRecipe(null);
      saveKeyRef.current = "";
    }
  }, [job]);

  function sharperRead() {
    keptRef.current =
      draft && job?.preview && isReviewDraftEdited(draft, job.preview) ? draft : null;
    retryPhotoImportJob({ enhanced: true });
  }

  function cancelImport() {
    cancelPhotoImportJob();
    onClose();
  }

  function finishSaved(recipe: { id: string; title?: string; servings?: number }) {
    window.sessionStorage.setItem(
      "ovenlovin.import-toast",
      JSON.stringify({
        title: recipe.title || draft?.title || "Untitled recipe",
        servings: recipe.servings ?? (draft?.servings.trim() ? Number(draft.servings) : 4),
      })
    );
    cancelPhotoImportJob();
    onClose();
    router.push(`/recipes/${recipe.id}`);
    router.refresh();
  }

  async function saveReview(event: React.FormEvent) {
    event.preventDefault();
    if (!draft || !job) return;
    setPending(true);
    setSaveError(null);
    setExistingRecipeUrl(null);
    try {
      const body = recipeCreateBodyFromReview(draft);
      let recipe = savedRecipe;
      if (!recipe) {
        if (!saveKeyRef.current) saveKeyRef.current = crypto.randomUUID();
        recipe = await api<{ id: string; title?: string; servings?: number }>("/api/v1/recipes", {
          method: "POST",
          keepalive: false,
          headers: { "Idempotency-Key": saveKeyRef.current },
          body: JSON.stringify(body),
        });
        setSavedRecipe(recipe);
      }
      if ((!body.images || body.images.length === 0) && job.files[0]) {
        try {
          const image = await compressPhotoForSave(job.files[0]);
          await api(`/api/v1/recipes/${recipe.id}/image`, {
            method: "POST",
            keepalive: false,
            body: JSON.stringify({ image }),
          });
        } catch {
          setSaveError(PHOTO_SAVE_NO_IMAGE_MESSAGE);
          setPending(false);
          return;
        }
      }
      finishSaved(recipe);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Could not save recipe");
      setExistingRecipeUrl(apiErrorRecipeUrl(err));
      setPending(false);
    }
  }

  const phase = job?.phase ?? "uploading";
  const offerSharper = job ? shouldOfferSharperRead(job) : false;

  return (
    <BottomSheet open={open} title="Import from photo" onClose={onClose}>
      {phase === "uploading" || phase === "reading" ? (
        <>
          <PhotoImportProgress
            phase={phase}
            percent={job?.percent ?? 0}
            previewUrls={job?.previewUrls ?? []}
            readingStartedAt={job?.readingStartedAt ?? null}
            pages={job?.files.length ?? 1}
            enhanced={job?.enhanced ?? false}
          />
          <div className="sheet-actions">
            <Button type="button" variant="tertiary" size="sm" onClick={cancelImport}>
              Cancel
            </Button>
          </div>
        </>
      ) : null}
      {phase === "error" ? (
        <div className="sheet-stack">
          <PhotoPages urls={job?.previewUrls ?? []} />
          <p className="import-warn" role="status" aria-live="polite">
            {job?.errorMessage}
          </p>
          {job?.errorKind === "blurry" ? (
            <div className="sheet-actions photo-import-error-actions">
              <Button type="button" variant="tertiary" size="sm" onClick={onTypeOrPaste}>
                Type or paste instead
              </Button>
              <Button
                type="button"
                variant={offerSharper ? "tertiary" : "default"}
                size="sm"
                onClick={cancelImport}
              >
                Retake photo
              </Button>
              {offerSharper ? (
                <Button type="button" size="sm" onClick={sharperRead}>
                  {PHOTO_IMPORT_SHARPER}
                </Button>
              ) : null}
            </div>
          ) : (
            <div className="sheet-actions photo-import-error-actions">
              <Button type="button" variant="tertiary" size="sm" onClick={onTypeOrPaste}>
                Type or paste instead
              </Button>
              <Button type="button" variant="tertiary" size="sm" onClick={cancelImport}>
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={() => retryPhotoImportJob({ enhanced: job?.enhanced })}
              >
                {job?.errorMessage === IMPORT_AI_UNAVAILABLE_MESSAGE ? "Try again" : "Retry"}
              </Button>
            </div>
          )}
        </div>
      ) : null}
      {phase === "review" && draft ? (
        <ImportReviewForm
          draft={draft}
          heroSrc={
            job?.previewUrls[0] ||
            (draft.images[0]?.startsWith("data:") || draft.images[0]?.startsWith("blob:")
              ? draft.images[0]
              : null) ||
            null
          }
          pending={pending}
          error={saveError}
          existingRecipeUrl={existingRecipeUrl}
          possibleDuplicate={job?.preview?.possibleDuplicate ?? null}
          savedRecipeId={savedRecipe?.id ?? null}
          pages={job?.files.length ?? 1}
          notice={job?.notice ?? null}
          replacePrompt={
            mine
              ? {
                  onReplace: () => setMine(null),
                  onKeep: () => {
                    setDraft(mine);
                    setMine(null);
                  },
                }
              : null
          }
          onSharperRead={offerSharper && !savedRecipe ? sharperRead : undefined}
          onOpenSaved={() => savedRecipe && finishSaved(savedRecipe)}
          onChange={setDraft}
          onSave={saveReview}
        />
      ) : null}
    </BottomSheet>
  );
}
