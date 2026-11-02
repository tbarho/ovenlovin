"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { groupCandidates, searchCandidates } from "@ovenlovin/core/contents-map";
import { api } from "@/lib/browser-api";
import type { BookContentsView } from "@/lib/book-import-view";
import { BookShotDoor } from "./BookShotDoor";
import { BookTriage } from "./BookTriage";

const POLL_MS = 3000;

/** Scans the contents read left unread. A picked recipe on one is read from its page image. */
export function scannedNote(count: number) {
  if (count === 0) return null;
  if (count === 1) return "1 page is a scan. A recipe you pick on it is read from the page image.";
  return `${count} pages are scans. Recipes you pick on them are read from the page images.`;
}

/** Nothing to pick: say so plainly and lead into the paper path. */
export const NO_CONTENTS_LINE = "We couldn't find a contents page. Photograph it instead.";

export function BookContents({ initial }: { initial: BookContentsView }) {
  const [view, setView] = useState(initial);
  const [picks, setPicks] = useState(initial.picks);
  const [query, setQuery] = useState("");
  const [saving, setSaving] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [starting, setStarting] = useState(false);
  const saves = useRef(Promise.resolve());
  const path = `/api/v1/books/imports/${view.jobId}`;
  const triaging = view.triage.summary.total > 0;

  useEffect(() => {
    if (view.status !== "reading" && view.triage.summary.pulling === 0) return;
    const timer = setTimeout(async () => {
      const next = await api<BookContentsView>(path).catch(() => null);
      if (!next) return;
      setView(next);
      setPicks(next.picks);
    }, POLL_MS);
    return () => clearTimeout(timer);
  }, [view, path]);

  const candidates = useMemo(() => view.map?.candidates ?? [], [view.map?.candidates]);
  const groups = useMemo(
    () => groupCandidates(searchCandidates(candidates, query)),
    [candidates, query]
  );

  function save(next: string[]) {
    setPicks(next);
    setSaving("saving");
    saves.current = saves.current.then(() =>
      api(path, { method: "PATCH", body: JSON.stringify({ picks: next }) })
        .then(() => setSaving("saved"))
        .catch(() => setSaving("error"))
    );
  }

  const toggle = (id: string) =>
    save(picks.includes(id) ? picks.filter((pick) => pick !== id) : [...picks, id]);

  const all = () => save(candidates.map((candidate) => candidate.id));
  const none = () => save([]);

  async function pull() {
    setStarting(true);
    await saves.current;
    const started = await api(path, { method: "POST" }).catch(() => null);
    const next = started ? await api<BookContentsView>(path).catch(() => null) : null;
    setStarting(false);
    if (!next) {
      setSaving("error");
      return;
    }
    setView(next);
  }

  return (
    <div className="book-contents">
      <div className="kitchen-head">
        <div>
          <Link href="/recipes" className="back-link">
            ← Recipes
          </Link>
          <h1>{view.name.replace(/\.pdf$/i, "")}</h1>
          <p className="muted">
            {triaging
              ? `${view.triage.summary.total} recipes picked.`
              : view.map
                ? `${picks.length} of ${candidates.length} recipes picked.`
                : `${view.pages || "Some"} pages.`}
          </p>
        </div>
      </div>

      {view.status === "reading" ? (
        <div className="sheet-stack">
          <p className="sheet-lead" role="status" aria-live="polite">
            Reading the contents
          </p>
          <div
            className="photo-import-meter is-indeterminate"
            role="progressbar"
            aria-label="Working"
          >
            <span />
          </div>
        </div>
      ) : null}

      {view.status === "failed" ? (
        <p className="muted import-error" role="alert">
          {view.error ?? "We could not read this book. Try adding it again."}
        </p>
      ) : null}

      {view.map && candidates.length === 0 ? (
        <div className="sheet-stack">
          <p className="muted" role="status">
            {NO_CONTENTS_LINE}
          </p>
          <BookShotDoor label="Photograph the contents" defaultName={view.name} />
        </div>
      ) : null}

      {triaging ? <BookTriage view={view} onChange={setView} /> : null}

      {!triaging && view.map && candidates.length > 0 ? (
        <div className="recipe-picker">
          {scannedNote(view.map.scannedPages.length) ? (
            <p className="muted">{scannedNote(view.map.scannedPages.length)}</p>
          ) : null}
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
            <button className="btn" type="button" onClick={all}>
              Select all
            </button>
            <button className="btn" type="button" onClick={none}>
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
            onClick={pull}
          >
            {starting
              ? "Starting"
              : `Pull ${picks.length} ${picks.length === 1 ? "recipe" : "recipes"}`}
          </button>
          {groups.length === 0 ? <p className="muted">No recipes match that search.</p> : null}
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
                      <span className="book-contents-page">
                        {candidate.printedPage
                          ? `p. ${candidate.printedPage}`
                          : `PDF p. ${candidate.pdfPage}`}
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      ) : null}
    </div>
  );
}
