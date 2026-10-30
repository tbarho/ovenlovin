"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { api, apiErrorRecipeUrl, type ApiClientError } from "@/lib/browser-api";
import type { RecipeDetails } from "@ovenlovin/core";
import {
  blankInstagramDraft,
  instagramFailurePresentation,
  type InstagramFailureCode,
  type InstagramNextStep,
  type InstagramPostKind,
} from "@ovenlovin/core/instagram";
import { canonicalInstagramPermalink } from "@ovenlovin/core/source-url";
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
import { ImportReviewForm, PhotoImportDialog } from "./PhotoImportDialog";
import { BookImportDoor } from "./BookImportDoor";
import { BookShotDoor } from "./BookShotDoor";
import { ImportFromDevice } from "./ImportFromDevice";
import { PhotoPick } from "./PhotoPick";
import { BottomSheet } from "./BottomSheet";
import { KitchenToast } from "./KitchenToast";
import { ImportProgress, type ImportProgressVariant } from "./ImportProgress";
import {
  CookbookPickList,
  CaptionPanel,
  InstagramErrorPanel,
  InstagramMark,
  InstagramReview,
  InstagramSaved,
  igDraftForSave,
  igReviewFromPreview,
  isInstagramPreview,
  type IgReviewState,
  type ImportPreview,
} from "./InstagramImportPanels";
import {
  recipeCreateBodyFromReview,
  reviewDraftFromImportPreview,
  type PhotoReviewDraft,
} from "@/lib/photo-import-review";

type Tab = "link" | "photo" | "cookbook";
type LinkMode = "url" | "paste";
type LinkView = "input" | "progress" | "error" | "caption" | "review" | "saved";

type IgClientError = {
  code: InstagramFailureCode;
  message: string;
  handle?: string;
  permalink?: string;
  kind?: InstagramPostKind;
};

const IG_CODES = new Set<InstagramFailureCode>([
  "instagram_private",
  "instagram_no_caption",
  "instagram_blocked",
]);

function readIgError(error: unknown): IgClientError | null {
  if (!error || typeof error !== "object") return null;
  const raw = error as ApiClientError;
  if (!raw.code || !IG_CODES.has(raw.code as InstagramFailureCode)) return null;
  const kind = raw.kind === "post" || raw.kind === "reel" ? raw.kind : undefined;
  return {
    code: raw.code as InstagramFailureCode,
    message: raw.message,
    handle: raw.handle,
    permalink: raw.permalink,
    kind,
  };
}

function failureCode(code: InstagramFailureCode): "private" | "no_caption" | "blocked" {
  if (code === "instagram_private") return "private";
  if (code === "instagram_no_caption") return "no_caption";
  return "blocked";
}

const IMPORT_TOAST_MS = 4000;
const LINK_PLACEHOLDER = "https://www.instagram.com/reel/...";
const PASTE_PLACEHOLDER =
  "Weeknight tomato pasta\n\nIngredients\n- 12 oz pasta\n- 1 jar tomatoes\n\nSteps\nBoil pasta. Warm sauce. Combine.";

export function ImportRecipeForm({
  remainingImports,
  importLimit,
  booksEnabled = false,
  showHeading = true,
  cookbooks = [],
  onDone,
}: {
  remainingImports?: number;
  importLimit?: number;
  booksEnabled?: boolean;
  showHeading?: boolean;
  cookbooks?: { id: string; name: string }[];
  /** Leave the import flow, e.g. close the hosting sheet. Gets the saved recipe id. */
  onDone?: (recipeId: string | null) => void;
} = {}) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("link");
  const [linkMode, setLinkMode] = useState<LinkMode>("url");
  const [linkView, setLinkView] = useState<LinkView>("input");
  const [url, setUrl] = useState("");
  const [paste, setPaste] = useState("");
  const [caption, setCaption] = useState("");
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
  const [imported, setImported] = useState<{ id: string; notice: string } | null>(null);
  const [retryable, setRetryable] = useState(false);
  const [review, setReview] = useState<PhotoReviewDraft | null>(null);
  const [reviewPreview, setReviewPreview] = useState<unknown>(null);
  const [progressVariant, setProgressVariant] = useState<ImportProgressVariant>("link");
  const [announce, setAnnounce] = useState("");
  const [igError, setIgError] = useState<IgClientError | null>(null);
  const [blockedAttempts, setBlockedAttempts] = useState(0);
  const [igReview, setIgReview] = useState<IgReviewState | null>(null);
  const [savedCookbook, setSavedCookbook] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [toast, setToast] = useState<{ message: string; step: string } | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [activePost, setActivePost] = useState<{
    permalink: string;
    kind: InstagramPostKind;
  } | null>(null);
  const importKeyRef = useRef("");
  const previewAbortRef = useRef<AbortController | null>(null);
  const requestRef = useRef(0);
  const pasteRef = useRef<HTMLTextAreaElement>(null);
  const linkRef = useRef<HTMLInputElement>(null);
  const rowSeq = useRef(0);
  const nextKey = useCallback(() => {
    rowSeq.current += 1;
    return `ig-row-${rowSeq.current}`;
  }, []);

  useEffect(() => {
    importKeyRef.current = "";
    setReview(null);
    setReviewPreview(null);
  }, [url, paste, linkMode]);

  useEffect(() => {
    setBlockedAttempts(0);
  }, [url]);

  useEffect(() => {
    if (tab === "link" && linkMode === "paste" && linkView === "input") pasteRef.current?.focus();
  }, [tab, linkMode, linkView]);

  useEffect(
    () =>
      subscribePhotoImportJob((next) => {
        setPhotoJob(next);
        if (next?.files.length) setPhotoFiles(next.files);
        if (!next) setPhotoFiles([]);
      }),
    []
  );

  const jobBusy = photoJob?.phase === "uploading" || photoJob?.phase === "reading";
  const detected = canonicalInstagramPermalink(url);
  const inlineLinkError =
    error === "Paste an Instagram link first." ||
    error?.startsWith("That does not look like a link.") === true;
  // A toast belongs to the step it was shown on and clears when the step changes.
  const step = `${tab}:${linkMode}:${linkView}`;
  const dismissToast = useCallback(() => setToast(null), []);
  useEffect(() => {
    setToast((current) => (current && current.step !== step ? null : current));
  }, [step]);
  const closePhoto = useCallback(() => setPhotoOpen(false), []);
  const closePicker = useCallback(() => setPickerOpen(false), []);

  const changePhotos = useCallback((next: File[]) => {
    setPhotoFiles(next);
    setError(null);
  }, []);

  function showFailure(err: unknown) {
    const message = err instanceof Error ? err.message : "Could not import recipe";
    setError(displayImportFailure(message));
    setExistingRecipeUrl(apiErrorRecipeUrl(err));
    setRetryable(isRetryableImportError(message));
    setLinkView("input");
  }

  async function runImport(body: Record<string, unknown>, variant: ImportProgressVariant) {
    previewAbortRef.current?.abort();
    const controller = new AbortController();
    previewAbortRef.current = controller;
    const requestId = ++requestRef.current;
    setProgressVariant(variant);
    setLinkView("progress");
    setAnnounce(
      variant === "recipe"
        ? "Reading the recipe."
        : variant === "caption"
          ? "Reading the caption."
          : "Finding the post."
    );
    setPending(true);
    setError(null);
    setRetryable(false);
    setExistingRecipeUrl(null);
    setIgError(null);
    try {
      const preview = await api<ImportPreview>("/api/v1/recipes/import", {
        method: "POST",
        keepalive: false,
        signal: controller.signal,
        body: JSON.stringify(body),
      });
      if (requestId !== requestRef.current) return;
      if (isInstagramPreview(preview)) {
        setIgReview(igReviewFromPreview(preview, nextKey));
        setLinkView("review");
        setAnnounce("Ready to review.");
      } else {
        setReviewPreview(preview);
        setReview(
          reviewDraftFromImportPreview(
            preview as Parameters<typeof reviewDraftFromImportPreview>[0]
          )
        );
        setLinkView("input");
        setAnnounce("Ready to review.");
      }
    } catch (err) {
      if (requestId !== requestRef.current || controller.signal.aborted) return;
      const ig = readIgError(err);
      if (ig) {
        if (ig.code === "instagram_blocked") setBlockedAttempts((count) => count + 1);
        setIgError(ig);
        setLinkView("error");
        setAnnounce("Import did not work. Next steps are listed.");
        return;
      }
      showFailure(err);
    } finally {
      if (previewAbortRef.current === controller) previewAbortRef.current = null;
      if (requestId === requestRef.current) setPending(false);
    }
  }

  function cancelPreview() {
    requestRef.current += 1;
    previewAbortRef.current?.abort();
    previewAbortRef.current = null;
    setPending(false);
    setLinkView("input");
    setToast({ message: "Import cancelled. Nothing saved.", step: `${tab}:${linkMode}:input` });
  }

  function onLinkSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (linkMode === "paste") {
      const inputError = importInputError("paste", paste);
      if (inputError) {
        setError(inputError);
        setRetryable(false);
        return;
      }
      void runImport({ source: "paste", content: paste }, "recipe");
      return;
    }
    const inputError = importInputError("url", url);
    if (inputError) {
      setError(inputError);
      setRetryable(false);
      setExistingRecipeUrl(null);
      return;
    }
    const post = canonicalInstagramPermalink(url);
    setActivePost(post);
    void runImport({ source: "url", content: url.trim() }, "link");
  }

  function onPhotoSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (photoFiles.length === 0) {
      setError("Add a photo first");
      return;
    }
    startPhotoImportJob(photoFiles);
    setPhotoOpen(true);
  }

  async function pasteLink() {
    try {
      const text = await navigator.clipboard.readText();
      if (text.trim()) {
        setUrl(text.trim());
        setError(null);
        setExistingRecipeUrl(null);
        return;
      }
    } catch {
      // Clipboard read is blocked in some browsers. Focus the field instead.
    }
    linkRef.current?.focus();
  }

  function openRecipePaste() {
    setTab("link");
    setLinkMode("paste");
    setLinkView("input");
    setError(null);
    setExistingRecipeUrl(null);
    setRetryable(false);
  }

  function readCaption() {
    if (!caption.trim()) {
      setToast({ message: "Paste the caption first.", step });
      return;
    }
    const permalink = igError?.permalink || activePost?.permalink;
    void runImport(
      {
        source: "paste",
        content: caption,
        ...(permalink ? { sourceUrl: permalink } : {}),
        ...(igError?.handle ? { creator: igError.handle } : {}),
      },
      "caption"
    );
  }

  function onIgStep(id: InstagramNextStep["id"]) {
    if (id === "retry") {
      void runImport({ source: "url", content: url.trim() }, "link");
      return;
    }
    if (id === "paste") {
      setLinkView("caption");
      setError(null);
      return;
    }
    if (id === "photo") {
      setTab("photo");
      setLinkView("input");
      setError(null);
      return;
    }
    if (id === "type") {
      const blank = blankInstagramDraft({
        permalink: igError?.permalink || activePost?.permalink,
        handle: igError?.handle,
        kind: igError?.kind || activePost?.kind,
      });
      const next = igReviewFromPreview(blank, nextKey);
      setIgReview({ ...next, title: "" });
      setLinkView("review");
      setAnnounce("Ready to review.");
      return;
    }
    setTab("link");
    setLinkMode("url");
    setLinkView("input");
    setError(null);
  }

  async function saveIg(cookbook?: { id: string; name: string }) {
    if (!igReview) return;
    if (!igReview.title.trim()) {
      setError("Give it a title.");
      return;
    }
    setPending(true);
    setError(null);
    setExistingRecipeUrl(null);
    try {
      if (!importKeyRef.current) importKeyRef.current = crypto.randomUUID();
      const draft = igDraftForSave(igReview);
      const recipe = await api<RecipeDetails>("/api/v1/recipes/import", {
        method: "POST",
        keepalive: false,
        headers: { "Idempotency-Key": importKeyRef.current },
        body: JSON.stringify({
          source: "paste",
          content: caption.trim() || igReview.title.trim(),
          ...(draft.source?.url ? { sourceUrl: draft.source.url } : {}),
          ...(draft.source?.author ? { creator: draft.source.author } : {}),
          ...(cookbook ? { cookbookId: cookbook.id } : {}),
          save: true,
          draft,
        }),
      });
      importKeyRef.current = "";
      setSavedId(recipe?.id ?? null);
      setSavedCookbook(cookbook?.name ?? null);
      setPickerOpen(false);
      setLinkView("saved");
      setAnnounce("Saved.");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not save recipe";
      setError(message);
      setExistingRecipeUrl(apiErrorRecipeUrl(err));
    } finally {
      setPending(false);
    }
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
          source: linkMode === "paste" ? "paste" : "url",
          content: linkMode === "paste" ? paste : url,
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

  function importAnother() {
    setUrl("");
    setPaste("");
    setCaption("");
    setIgReview(null);
    setIgError(null);
    setSavedCookbook(null);
    setSavedId(null);
    setImported(null);
    setError(null);
    setActivePost(null);
    setLinkMode("url");
    setLinkView("input");
    setTab("link");
    setAnnounce("");
  }

  function backToRecipes() {
    const recipeId = savedId;
    importAnother();
    router.refresh();
    onDone?.(recipeId);
  }

  const shownError = igError
    ? instagramFailurePresentation({
        code: failureCode(igError.code),
        attempts: Math.max(1, blockedAttempts),
        handle: igError.handle,
        kind: igError.kind,
        permalink: igError.permalink || activePost?.permalink,
      })
    : null;

  const inFlow = tab === "link" && linkView !== "input";

  return (
    <>
      <div className={showHeading ? "form-card import-card" : "form-card import-card is-bare"}>
        <div className="import-toolbar">
          {showHeading ? <h2>Import a recipe</h2> : null}
          {remainingImports != null && importLimit != null ? (
            <p className="muted" data-testid="import-quota">
              {remainingImports} of {importLimit} left
            </p>
          ) : null}
        </div>
        {inFlow ? null : (
          <div className="tabs import-tabs" role="tablist" aria-label="Import method">
            {(
              [
                ["link", "Link"],
                ["photo", "Photo"],
                ["cookbook", "Cookbook"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                role="tab"
                className="tab"
                aria-selected={tab === id}
                onClick={() => {
                  setTab(id);
                  setError(null);
                  if (id === "link") setLinkMode("url");
                }}
              >
                {label}
              </button>
            ))}
          </div>
        )}
        <p className="sr-only" role="status" aria-live="polite">
          {announce}
        </p>
        {photoJob && jobBusy && !photoOpen && !inFlow ? (
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

        {tab === "link" && linkView === "progress" ? (
          <ImportProgress variant={progressVariant} onCancel={cancelPreview} />
        ) : null}
        {tab === "link" && linkView === "error" && shownError ? (
          <InstagramErrorPanel
            heading={shownError.heading}
            message={shownError.message}
            nextSteps={shownError.nextSteps}
            onStep={onIgStep}
          />
        ) : null}
        {tab === "link" && linkView === "caption" ? (
          <CaptionPanel
            value={caption}
            handle={igError?.handle}
            onChange={setCaption}
            onRead={readCaption}
            pending={pending}
          />
        ) : null}
        {tab === "link" && linkView === "review" && igReview ? (
          <InstagramReview
            state={igReview}
            pending={pending}
            error={error}
            existingRecipeUrl={existingRecipeUrl}
            onChange={setIgReview}
            onSaveKitchen={() => void saveIg()}
            onSaveCookbook={() => setPickerOpen(true)}
            nextKey={nextKey}
          />
        ) : null}
        {tab === "link" && linkView === "saved" && igReview ? (
          <InstagramSaved
            title={igReview.title}
            handle={igReview.creator}
            servings={igReview.servings}
            ingredientCount={igReview.ingredients.filter((row) => row.text.trim()).length}
            cookbookName={savedCookbook}
            onAnother={importAnother}
            onBack={backToRecipes}
          />
        ) : null}

        {tab === "photo" ? (
          <form onSubmit={onPhotoSubmit}>
            <PhotoPick files={photoFiles} onChange={changePhotos} />
            <button
              className="btn primary import-submit"
              type="submit"
              disabled={photoFiles.length === 0 || jobBusy}
            >
              {photoImportButtonLabel(photoFiles.length)}
            </button>
            {error ? <p className="muted import-error">{error}</p> : null}
          </form>
        ) : null}

        {tab === "cookbook" ? (
          booksEnabled ? (
            <>
              <BookImportDoor />
              <BookShotDoor />
            </>
          ) : (
            <p className="muted">Cookbooks from a PDF or paper pages are off in this kitchen.</p>
          )
        ) : null}

        {tab === "link" && (linkView === "input" || linkView === "progress") ? (
          <form hidden={linkView !== "input"} onSubmit={onLinkSubmit}>
            {linkMode === "url" ? (
              <>
                <label className="field">
                  <span className="field-label">Recipe or Instagram link</span>
                  <input
                    ref={linkRef}
                    value={url}
                    inputMode="url"
                    onChange={(event) => {
                      setUrl(event.target.value);
                      setError(null);
                      setExistingRecipeUrl(null);
                    }}
                    placeholder={LINK_PLACEHOLDER}
                    aria-invalid={inlineLinkError || undefined}
                  />
                </label>
                <p className="muted import-hint">
                  In Instagram: tap Share, then Copy link, then paste here. Public posts only.
                </p>
                {detected ? (
                  <p className="import-detect">
                    <InstagramMark />
                    <span>
                      Instagram {detected.kind === "post" ? "post" : "Reel"} link. We read the
                      caption.
                    </span>
                  </p>
                ) : null}
                <div className="import-actions">
                  <button type="button" className="btn" onClick={() => void pasteLink()}>
                    Paste
                  </button>
                  <button className="btn primary import-submit" type="submit">
                    Import
                  </button>
                </div>
                {error && !inlineLinkError ? null : (
                  <button type="button" className="import-quiet" onClick={openRecipePaste}>
                    Paste the recipe text
                  </button>
                )}
              </>
            ) : (
              <>
                <label className="field">
                  <span className="field-label">Recipe text</span>
                  <textarea
                    ref={pasteRef}
                    value={paste}
                    onChange={(event) => {
                      setPaste(event.target.value);
                      setError(null);
                      setExistingRecipeUrl(null);
                    }}
                    placeholder={PASTE_PLACEHOLDER}
                  />
                </label>
                <div className="import-actions">
                  <button
                    className="btn primary import-submit"
                    type="submit"
                    disabled={!paste.trim()}
                  >
                    Import
                  </button>
                </div>
                <button
                  type="button"
                  className="import-quiet"
                  onClick={() => {
                    setLinkMode("url");
                    setError(null);
                  }}
                >
                  Use a link
                </button>
              </>
            )}
            {error && inlineLinkError ? <p className="muted import-error">{error}</p> : null}
            {error && !inlineLinkError ? (
              <div className="import-blocked" role="status">
                <p className="muted import-error">
                  {error}
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
                      <button
                        type="submit"
                        className="btn"
                        disabled={pending || (linkMode === "paste" && !paste.trim())}
                      >
                        Try again
                      </button>
                    ) : null}
                    {linkMode !== "paste" ? (
                      <button type="button" className="btn" onClick={openRecipePaste}>
                        Paste the recipe text
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className="btn"
                      onClick={() => {
                        setTab("photo");
                        setError(null);
                      }}
                    >
                      Add a photo
                    </button>
                  </div>
                ) : null}
              </div>
            ) : null}
          </form>
        ) : null}
        {imported && linkView !== "saved" ? (
          <p className="muted" data-testid="import-review">
            {imported.notice} · <a href={`/recipes/${imported.id}`}>Add to cookbook</a>
          </p>
        ) : null}
      </div>

      {inFlow ? null : <ImportFromDevice />}

      <BottomSheet
        open={Boolean(review)}
        title="Review before saving"
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
            saveLabel="Save to kitchen"
            onOpenSaved={() => imported && router.push(`/recipes/${imported.id}`)}
            onChange={setReview}
            onSave={saveReview}
          />
        ) : null}
      </BottomSheet>
      <BottomSheet open={pickerOpen} title="Save to a cookbook" onClose={closePicker}>
        <CookbookPickList
          cookbooks={cookbooks}
          pending={pending}
          onSave={(cookbook) => void saveIg(cookbook)}
        />
      </BottomSheet>
      <PhotoImportDialog
        open={photoOpen}
        onClose={closePhoto}
        onTypeOrPaste={() => {
          cancelPhotoImportJob();
          setPhotoOpen(false);
          openRecipePaste();
        }}
      />
      <KitchenToast
        message={toast?.step === step ? toast.message : null}
        onDismiss={dismissToast}
        durationMs={IMPORT_TOAST_MS}
      />
    </>
  );
}
