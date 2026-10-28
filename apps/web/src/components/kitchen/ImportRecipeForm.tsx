"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { api, apiErrorRecipeUrl } from "@/lib/browser-api";
import type { RecipeDetails } from "@ovenlovin/core";
import {
  displayImportFailure,
  importGuessedNotice,
  importInputError,
  isRetryableImportError,
} from "@/lib/import-input";
import {
  PHOTO_IMPORT_ESTIMATE,
  PHOTO_IMPORT_IN_PROGRESS,
  photoImportButtonLabel,
  readingStepLabel,
  uploadingStepLabel,
} from "@/lib/photo-import-client";
import {
  cancelPhotoImportJob,
  getPhotoImportJob,
  startPhotoImportJob,
  subscribePhotoImportJob,
  type PhotoImportJobSnapshot,
} from "@/lib/photo-import-job";
import { ImportReviewForm, PhotoImportDialog, PhotoImportProgress } from "./PhotoImportDialog";
import { BookImportDoor } from "./BookImportDoor";
import { BookShotDoor } from "./BookShotDoor";
import { ImportFromDevice } from "./ImportFromDevice";
import { PhotoPick } from "./PhotoPick";
import { BottomSheet } from "./BottomSheet";
import {
  recipeCreateBodyFromReview,
  reviewDraftFromImportPreview,
  type PhotoReviewDraft,
} from "@/lib/photo-import-review";

export function ImportRecipeForm({
  remainingImports,
  importLimit,
  booksEnabled = false,
}: {
  remainingImports?: number;
  importLimit?: number;
  booksEnabled?: boolean;
} = {}) {
  const router = useRouter();
  const [source, setSource] = useState<"url" | "paste" | "photo">("url");
  const [url, setUrl] = useState("");
  const [paste, setPaste] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [existingRecipeUrl, setExistingRecipeUrl] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [photoFiles, setPhotoFiles] = useState<File[]>(() => getPhotoImportJob()?.files ?? []);
  const [photoOpen, setPhotoOpen] = useState(() => {
    const existing = getPhotoImportJob();
    return Boolean(existing && (existing.phase === "uploading" || existing.phase === "reading"));
  });
  const [photoJob, setPhotoJob] = useState<PhotoImportJobSnapshot | null>(() =>
    getPhotoImportJob()
  );
  const [imported, setImported] = useState<{
    id: string;
    notice: string;
  } | null>(null);
  const [retryable, setRetryable] = useState(false);
  const [review, setReview] = useState<PhotoReviewDraft | null>(null);
  const [reviewPreview, setReviewPreview] = useState<unknown>(null);
  const importKeyRef = useRef("");
  const previewAbortRef = useRef<AbortController | null>(null);
  const pasteRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    importKeyRef.current = "";
    setReview(null);
    setReviewPreview(null);
  }, [source, url, paste]);
  useEffect(() => {
    if (source === "paste") pasteRef.current?.focus();
  }, [source]);
  const fieldValue = source === "paste" ? paste : url;
  const canSubmit = source === "photo" ? photoFiles.length > 0 : Boolean(fieldValue.trim());
  const jobBusy = photoJob?.phase === "uploading" || photoJob?.phase === "reading";

  useEffect(
    () =>
      subscribePhotoImportJob((next) => {
        setPhotoJob(next);
        if (next?.files.length) setPhotoFiles(next.files);
        if (!next) setPhotoFiles([]);
      }),
    []
  );

  const changePhotos = useCallback((next: File[]) => {
    setPhotoFiles(next);
    setError(null);
  }, []);

  const closePhoto = useCallback(() => setPhotoOpen(false), []);

  const typeOrPaste = useCallback(() => {
    cancelPhotoImportJob();
    setPhotoOpen(false);
    setSource("paste");
  }, []);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (source === "photo") {
      if (photoFiles.length === 0) {
        setError("Add a photo first");
        return;
      }
      startPhotoImportJob(photoFiles);
      setPhotoOpen(true);
      return;
    }
    const inputError = importInputError(source, fieldValue);
    if (inputError) {
      setError(inputError);
      setRetryable(false);
      return;
    }
    previewAbortRef.current?.abort();
    const controller = new AbortController();
    previewAbortRef.current = controller;
    setPending(true);
    setError(null);
    setRetryable(false);
    setExistingRecipeUrl(null);
    try {
      const preview = await api<Parameters<typeof reviewDraftFromImportPreview>[0]>(
        "/api/v1/recipes/import",
        {
          method: "POST",
          keepalive: false,
          signal: controller.signal,
          body: JSON.stringify({ source, content: fieldValue }),
        }
      );
      setReviewPreview(preview);
      setReview(reviewDraftFromImportPreview(preview));
    } catch (err) {
      if (controller.signal.aborted) return;
      const message = err instanceof Error ? err.message : "Could not import recipe";
      setError(message);
      setExistingRecipeUrl(apiErrorRecipeUrl(err));
      setRetryable(isRetryableImportError(message));
    } finally {
      if (previewAbortRef.current === controller) previewAbortRef.current = null;
      setPending(false);
    }
  }

  function cancelPreview() {
    previewAbortRef.current?.abort();
    previewAbortRef.current = null;
    setPending(false);
  }

  async function saveReview(event: React.FormEvent) {
    event.preventDefault();
    if (!review) return;
    setPending(true);
    setError(null);
    setExistingRecipeUrl(null);
    try {
      if (!importKeyRef.current) importKeyRef.current = crypto.randomUUID();
      const recipe = await api<RecipeDetails>("/api/v1/recipes/import", {
        method: "POST",
        keepalive: false,
        headers: { "Idempotency-Key": importKeyRef.current },
        body: JSON.stringify({
          source,
          content: fieldValue,
          save: true,
          draft: {
            ...(typeof reviewPreview === "object" && reviewPreview ? reviewPreview : {}),
            ...recipeCreateBodyFromReview(review),
          },
        }),
      });
      importKeyRef.current = "";
      setReview(null);
      setReviewPreview(null);
      setImported({
        id: recipe.id,
        notice: importGuessedNotice(recipe.title, recipe.servings ?? null),
      });
      window.sessionStorage.setItem(
        "ovenlovin.import-toast",
        JSON.stringify({ title: recipe.title, servings: recipe.servings ?? null })
      );
      router.push(`/recipes/${recipe.id}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not save recipe";
      setError(message);
      setExistingRecipeUrl(apiErrorRecipeUrl(err));
      setRetryable(isRetryableImportError(message));
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <form className="form-card import-card" onSubmit={onSubmit}>
        <div className="import-toolbar">
          <h2>Import a recipe</h2>
          {remainingImports != null && importLimit != null ? (
            <p className="muted" data-testid="import-quota">
              {remainingImports} of {importLimit} left
            </p>
          ) : null}
          <div className="tabs import-tabs" role="tablist">
            <button
              type="button"
              role="tab"
              className="tab"
              aria-selected={source === "url"}
              onClick={() => {
                setSource("url");
                setError(null);
              }}
            >
              URL
            </button>
            <button
              type="button"
              role="tab"
              className="tab"
              aria-selected={source === "paste"}
              onClick={() => {
                setSource("paste");
                setError(null);
              }}
            >
              Paste
            </button>
            <button
              type="button"
              role="tab"
              className="tab"
              aria-selected={source === "photo"}
              onClick={() => {
                setSource("photo");
                setError(null);
              }}
            >
              Photo
            </button>
          </div>
        </div>
        {photoJob && jobBusy && !photoOpen ? (
          <div className="photo-import-banner" data-testid="photo-import-progress">
            {photoJob.previewUrls[0] ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={photoJob.previewUrls[0]} alt="Selected recipe photo" />
            ) : (
              <span className="photo-thumb-fallback" aria-hidden="true" />
            )}
            <div>
              <strong>{PHOTO_IMPORT_IN_PROGRESS}</strong>
              <p>
                {photoJob.phase === "uploading"
                  ? uploadingStepLabel(photoJob.percent)
                  : readingStepLabel(photoJob.files.length)}
              </p>
              <p className="muted">{PHOTO_IMPORT_ESTIMATE}.</p>
            </div>
            <div className="photo-import-banner-actions">
              <button type="button" className="btn compact" onClick={() => setPhotoOpen(true)}>
                Open
              </button>
              <button type="button" className="btn compact" onClick={() => cancelPhotoImportJob()}>
                Cancel
              </button>
            </div>
          </div>
        ) : null}
        {source === "photo" ? (
          <>
            <PhotoPick files={photoFiles} onChange={changePhotos} />
            <button
              className="btn primary import-submit"
              type="submit"
              disabled={!canSubmit || jobBusy}
            >
              {photoImportButtonLabel(photoFiles.length)}
            </button>
          </>
        ) : (
          <div className="import-row">
            <div className="import-field">
              {source === "url" ? (
                <input
                  value={url}
                  onChange={(event) => {
                    setUrl(event.target.value);
                    setError(null);
                    setExistingRecipeUrl(null);
                  }}
                  placeholder="https://example.com/chocolate-chip-cookies"
                  required
                />
              ) : (
                <textarea
                  ref={pasteRef}
                  value={paste}
                  onChange={(event) => {
                    setPaste(event.target.value);
                    setError(null);
                    setExistingRecipeUrl(null);
                  }}
                  placeholder={
                    "Weeknight tomato pasta\n\nIngredients\n- 12 oz pasta\n- 1 jar tomatoes\n\nSteps\nBoil pasta. Warm sauce. Combine."
                  }
                  required
                />
              )}
            </div>
            {pending ? (
              <div data-testid="import-progress">
                <PhotoImportProgress phase="reading" percent={100} previewUrls={[]} />
                <div className="sheet-actions">
                  <button type="button" className="btn compact" onClick={cancelPreview}>
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button className="btn primary import-submit" type="submit" disabled={!canSubmit}>
                Import
              </button>
            )}
          </div>
        )}
        {error ? (
          <div className="import-blocked" role="status">
            <p className="muted import-error">
              {displayImportFailure(error)}
              {existingRecipeUrl ? (
                <>
                  {" "}
                  <a href={existingRecipeUrl}>Open that recipe</a>
                </>
              ) : null}
            </p>
            {!existingRecipeUrl ? (
              <div className="import-blocked-actions">
                {retryable ? (
                  <button type="submit" className="btn" disabled={pending || !canSubmit}>
                    Try again
                  </button>
                ) : null}
                {source !== "paste" ? (
                  <button
                    type="button"
                    className="btn"
                    onClick={() => {
                      setSource("paste");
                      setError(null);
                    }}
                  >
                    Paste the recipe text
                  </button>
                ) : null}
                {source !== "photo" ? (
                  <button
                    type="button"
                    className="btn"
                    onClick={() => {
                      setSource("photo");
                      setError(null);
                    }}
                  >
                    Add a photo
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}
        {imported ? (
          <p className="muted" data-testid="import-review">
            {imported.notice} · <a href={`/recipes/${imported.id}`}>Add to cookbook</a>
          </p>
        ) : null}
      </form>
      <BottomSheet
        open={Boolean(review)}
        title="Review import"
        onClose={() => {
          setReview(null);
          setReviewPreview(null);
        }}
      >
        {review ? (
          <ImportReviewForm
            draft={review}
            heroSrc={null}
            pending={pending}
            error={error}
            existingRecipeUrl={existingRecipeUrl}
            possibleDuplicate={null}
            savedRecipeId={imported?.id ?? null}
            showPhotoChrome={false}
            onOpenSaved={() => imported && router.push(`/recipes/${imported.id}`)}
            onChange={setReview}
            onSave={saveReview}
          />
        ) : null}
      </BottomSheet>
      <PhotoImportDialog open={photoOpen} onClose={closePhoto} onTypeOrPaste={typeOrPaste} />
      {booksEnabled ? (
        <>
          <BookImportDoor />
          <BookShotDoor />
        </>
      ) : null}
      <ImportFromDevice />
    </>
  );
}
