"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
// The contents-map subpath, not the jobs barrel: this is a client component.
import { groupCandidates, searchCandidates } from "@ovenlovin/core/contents-map";
import type { TriageRow } from "@ovenlovin/core/jobs";
import { api } from "@/lib/browser-api";
import type { BookShotView } from "@/lib/book-shot-view";
import {
  PHOTO_IMPORT_SHARPER,
  extractPhotoPreviewFromFiles,
  photoImportErrorKind,
  shouldOfferSharperRead,
  type PhotoImportErrorKind,
} from "@/lib/photo-import-client";
import {
  recipeCreateBodyFromReview,
  reviewDraftFromPreview,
  type PhotoReviewDraft,
} from "@/lib/photo-import-review";
import type { PhotoImportPreview } from "@/lib/photo-import";
import { BottomSheet } from "./BottomSheet";
import { ImportReviewForm, PhotoImportProgress } from "./PhotoImportDialog";
import { PhotoPick } from "./PhotoPick";

/** One recipe being photographed: pick pages, read them, review, save. */
type Shoot =
  | { phase: "pick"; row: TriageRow; files: File[] }
  | {
      phase: "working";
      row: TriageRow;
      files: File[];
      urls: string[];
      percent: number;
      stage: "uploading" | "reading";
      enhanced: boolean;
    }
  | {
      phase: "review";
      row: TriageRow;
      files: File[];
      urls: string[];
      preview: PhotoImportPreview;
      draft: PhotoReviewDraft;
      enhanced: boolean;
    }
  | {
      phase: "failed";
      row: TriageRow;
      files: File[];
      urls: string[];
      message: string;
      kind: PhotoImportErrorKind;
      enhanced: boolean;
    };

const shotRowLabel = (row: TriageRow) => (row.page > 0 ? `p. ${row.page} ${row.title}` : row.title);

/**
 * The paper book screen. Before the picks are confirmed it is the same contents
 * picker as a PDF. After, it is the shot list: each picked recipe by page, and
 * a Photograph button that runs the usual multi-page photo import and files
 * the recipe into the book's cookbook.
 */
export function BookShotList({ initial }: { initial: BookShotView }) {
  const [view, setView] = useState(initial);
  const [picks, setPicks] = useState(initial.picks);
  const [query, setQuery] = useState("");
  const [saving, setSaving] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [starting, setStarting] = useState(false);
  const [shoot, setShoot] = useState<Shoot | null>(null);
  const [shootError, setShootError] = useState<string | null>(null);
  const [shootPending, setShootPending] = useState(false);
  const urlsRef = useRef<string[]>([]);
  const path = `/api/v1/books/imports/${view.jobId}`;

  useEffect(
    () => () => {
      for (const url of urlsRef.current) URL.revokeObjectURL(url);
    },
    []
  );

  const candidates = useMemo(() => view.map?.candidates ?? [], [view.map?.candidates]);
  const groups = useMemo(
    () => groupCandidates(searchCandidates(candidates, query)),
    [candidates, query]
  );
  const { rows, summary, line } = view.triage;
  const toShoot = rows.filter((row) => row.state === "shoot");
  const saved = rows.filter((row) => row.state === "saved");

  function savePicks(next: string[]) {
    setPicks(next);
    setSaving("saving");
    api(path, { method: "PATCH", body: JSON.stringify({ picks: next }) })
      .then(() => setSaving("saved"))
      .catch(() => setSaving("error"));
  }

  const toggle = (id: string) =>
    savePicks(picks.includes(id) ? picks.filter((pick) => pick !== id) : [...picks, id]);

  async function confirmPicks() {
    setStarting(true);
    try {
      const started = await api<{ view: BookShotView }>(path, { method: "POST" });
      if (started.view) {
        setView(started.view);
        setPicks(started.view.picks);
      }
    } catch {
      setSaving("error");
    } finally {
      setStarting(false);
    }
  }

  /** The same multi-page photo import the kitchen uses, aimed at one shot. */
  function readPages(row: TriageRow, files: File[], enhanced = false) {
    for (const url of urlsRef.current) URL.revokeObjectURL(url);
    const urls = files.map((file) => URL.createObjectURL(file));
    urlsRef.current = urls;
    setShootError(null);
    setShoot({ phase: "working", row, files, urls, percent: 0, stage: "uploading", enhanced });
    extractPhotoPreviewFromFiles(files, {
      enhanced,
      onPhase: (stage) =>
        setShoot((current) => {
          if (current?.phase !== "working") return current;
          return { ...current, stage, percent: stage === "reading" ? 100 : current.percent };
        }),
      onUploadProgress: (percent) =>
        setShoot((current) => (current?.phase === "working" ? { ...current, percent } : current)),
    })
      .then((preview) =>
        setShoot({
          phase: "review",
          row,
          files,
          urls,
          preview,
          draft: reviewDraftFromPreview(preview),
          enhanced,
        })
      )
      .catch((error: unknown) =>
        setShoot({
          phase: "failed",
          row,
          files,
          urls,
          message:
            error instanceof Error ? error.message : "We could not read those pages. Try again.",
          kind: photoImportErrorKind(error),
          enhanced,
        })
      );
  }

  async function saveShot(event: React.FormEvent) {
    event.preventDefault();
    if (shoot?.phase !== "review") return;
    setShootPending(true);
    setShootError(null);
    try {
      const result = await api<{ view: BookShotView }>(`${path}/recipes`, {
        method: "POST",
        keepalive: false,
        body: JSON.stringify({
          items: [
            {
              candidateId: shoot.row.candidateId,
              reviewed: recipeCreateBodyFromReview(shoot.draft),
            },
          ],
        }),
      });
      if (result.view) setView(result.view);
      closeShoot();
    } catch (err) {
      setShootError(err instanceof Error ? err.message : "Could not save. Try again.");
    } finally {
      setShootPending(false);
    }
  }

  function closeShoot() {
    for (const url of urlsRef.current) URL.revokeObjectURL(url);
    urlsRef.current = [];
    setShoot(null);
    setShootError(null);
    setShootPending(false);
  }

  const offerSharper =
    shoot?.phase === "review" &&
    shouldOfferSharperRead({ enhanced: shoot.enhanced, preview: shoot.preview });

  return (
    <div className="book-contents">
      <div className="kitchen-head">
        <div>
          <Link href="/recipes" className="back-link">
            ← Recipes
          </Link>
          <h1>{view.name.replace(/\.pdf$/i, "")}</h1>
          <p className="muted">
            {view.shooting ? `${line}.` : `${picks.length} of ${candidates.length} recipes picked.`}
          </p>
        </div>
      </div>

      {!view.shooting ? (
        <div className="recipe-picker">
          <label className="field">
            <span className="field-label">Search the contents</span>
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Soup, pancakes, baking…"
            />
          </label>
          <div className="book-contents-bar">
            <button
              className="btn"
              type="button"
              onClick={() => savePicks(candidates.map((candidate) => candidate.id))}
            >
              Select all
            </button>
            <button className="btn" type="button" onClick={() => savePicks([])}>
              Select none
            </button>
            <span className="muted" role="status" aria-live="polite">
              {saving === "saving" ? "Saving" : null}
              {saving === "saved" ? "Saved" : null}
              {saving === "error" ? "Could not save. Try again." : null}
            </span>
          </div>
          <button
            className="btn primary"
            type="button"
            disabled={picks.length === 0 || starting}
            onClick={confirmPicks}
          >
            {starting
              ? "Making"
              : `Make a shot list for ${picks.length} ${picks.length === 1 ? "recipe" : "recipes"}`}
          </button>
          {groups.map((group) => (
            <section key={group.name} className="book-contents-group" aria-label={group.name}>
              <h2>{group.name}</h2>
              <ul className="recipe-pick-list">
                {group.items.map((candidate) => (
                  <li key={candidate.id}>
                    <label className="book-contents-row">
                      <input
                        type="checkbox"
                        checked={picks.includes(candidate.id)}
                        onChange={() => toggle(candidate.id)}
                      />
                      <span>{candidate.title}</span>
                      {candidate.printedPage ? (
                        <span className="book-contents-page">p. {candidate.printedPage}</span>
                      ) : null}
                    </label>
                  </li>
                ))}
              </ul>
            </section>
          ))}
          {groups.length === 0 ? <p className="muted">No recipes match that search.</p> : null}
        </div>
      ) : (
        <div className="book-triage">
          <p className="sheet-lead" role="status" aria-live="polite">
            {line}. Photograph each recipe as you go.
          </p>

          {toShoot.length > 0 ? (
            <section className="book-contents-group" aria-label="Still to photograph">
              <h2>Still to photograph</h2>
              <ul className="recipe-pick-list">
                {toShoot.map((row) => (
                  <li key={row.candidateId} className="book-contents-row book-triage-row">
                    <span>{shotRowLabel(row)}</span>
                    <button
                      className="btn compact"
                      type="button"
                      onClick={() => setShoot({ phase: "pick", row, files: [] })}
                    >
                      Photograph
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
                    {row.page > 0 ? (
                      <span className="book-contents-page">p. {row.page}</span>
                    ) : null}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {view.cookbookId ? (
            <Link className="btn" href={`/recipes?cookbook=${view.cookbookId}`}>
              Open the cookbook
            </Link>
          ) : null}
          {summary.total > 0 && saved.length < summary.total ? (
            <p className="muted">
              Each shot can hold up to 6 pages. A photographed page is the recipe&apos;s record, not
              its photo.
            </p>
          ) : null}
        </div>
      )}

      <BottomSheet
        open={Boolean(shoot)}
        title={shoot ? shoot.row.title : "Photograph recipe"}
        onClose={() => {
          if (shoot?.phase === "working") return;
          closeShoot();
        }}
      >
        {shoot?.phase === "pick" ? (
          <div className="sheet-stack">
            <p className="sheet-lead">
              Photograph {shoot.row.page > 0 ? `page ${shoot.row.page}` : "the recipe"} in the book.
              All of its pages, in order.
            </p>
            <PhotoPick
              files={shoot.files}
              onChange={(files) => setShoot({ phase: "pick", row: shoot.row, files })}
            />
            <button
              className="btn primary"
              type="button"
              disabled={shoot.files.length === 0}
              onClick={() => readPages(shoot.row, shoot.files)}
            >
              Read {shoot.files.length > 1 ? `${shoot.files.length} pages` : "the page"}
            </button>
          </div>
        ) : null}
        {shoot?.phase === "working" ? (
          <>
            <PhotoImportProgress
              phase={shoot.stage}
              percent={shoot.percent}
              previewUrls={shoot.urls}
              pages={shoot.files.length}
              enhanced={shoot.enhanced}
            />
            <div className="sheet-actions">
              <button type="button" className="btn compact" onClick={closeShoot}>
                Cancel
              </button>
            </div>
          </>
        ) : null}
        {shoot?.phase === "failed" ? (
          <div className="sheet-stack">
            <p className="import-warn" role="status" aria-live="polite">
              {shoot.message}
            </p>
            <div className="sheet-actions photo-import-error-actions">
              <button
                type="button"
                className="btn compact"
                onClick={() => setShoot({ phase: "pick", row: shoot.row, files: [] })}
              >
                Choose pages again
              </button>
              {!shoot.enhanced && shoot.kind === "blurry" ? (
                <button
                  type="button"
                  className="btn primary compact"
                  onClick={() => readPages(shoot.row, shoot.files, true)}
                >
                  {PHOTO_IMPORT_SHARPER}
                </button>
              ) : shoot.kind !== "cancelled" ? (
                <button
                  type="button"
                  className="btn primary compact"
                  onClick={() => readPages(shoot.row, shoot.files, shoot.enhanced)}
                >
                  Try again
                </button>
              ) : null}
            </div>
          </div>
        ) : null}
        {shoot?.phase === "review" ? (
          <ImportReviewForm
            draft={shoot.draft}
            heroSrc={null}
            pending={shootPending}
            error={shootError}
            existingRecipeUrl={null}
            possibleDuplicate={shoot.preview.possibleDuplicate ?? null}
            savedRecipeId={null}
            showPhotoChrome
            pages={shoot.files.length}
            onSharperRead={offerSharper ? () => readPages(shoot.row, shoot.files, true) : undefined}
            onOpenSaved={() => undefined}
            onChange={(draft) =>
              setShoot((current) => (current?.phase === "review" ? { ...current, draft } : current))
            }
            onSave={saveShot}
          />
        ) : null}
      </BottomSheet>
    </div>
  );
}
