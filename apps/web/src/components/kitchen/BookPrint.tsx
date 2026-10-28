"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/browser-api";
import { BottomSheet } from "./BottomSheet";

export const PRINT_CHOICES = [
  {
    mode: "home",
    title: "At home",
    detail: "US Letter pages, edge to edge as you see them. Print on any printer.",
  },
  {
    mode: "shop",
    title: "At a print shop",
    detail: "Same pages with 1/8 in bleed and crop marks, fonts embedded, photos at full size.",
  },
] as const;

const POLL_MS = 1500;

export function printProgressLabel(view: any) {
  if (view.status === "ready") return `Ready. ${view.pages} pages.`;
  return `Making ${view.pages} pages · ${view.done} of ${view.total} parts done`;
}

export function megabytes(bytes: number | null) {
  return bytes ? `${(bytes / (1024 * 1024)).toFixed(1)} MB` : "";
}

/**
 * Print the book: pick at home or at a print shop, then the PDF is made on
 * the job worker in chunks. The sheet polls progress and hands back the file.
 */
export function BookPrint({ bookId }: { bookId: string }) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"home" | "shop">("home");
  const [view, setView] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const running = view?.status === "running";

  useEffect(() => {
    if (!running) return;
    const timer = setTimeout(async () => {
      try {
        setView(await api<any>(`/api/v1/cookbooks/${bookId}/pdf/${view.jobId}`));
      } catch (err) {
        setError(err instanceof Error ? err.message : "We lost track of the PDF. Try again.");
        setView(null);
      }
    }, POLL_MS);
    return () => clearTimeout(timer);
  }, [bookId, running, view]);

  async function make() {
    setBusy(true);
    setError(null);
    try {
      setView(
        await api<any>(`/api/v1/cookbooks/${bookId}/pdf`, {
          method: "POST",
          body: JSON.stringify({ mode }),
        })
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "We could not start the PDF. Try again.");
    } finally {
      setBusy(false);
    }
  }

  const reset = () => {
    setView(null);
    setError(null);
  };
  const choosing = !view || view.status === "failed" || view.status === "expired";
  const percent = view ? Math.round((view.done / view.total) * 100) : 0;

  return (
    <>
      <button className="btn book-print-open" type="button" onClick={() => setOpen(true)}>
        Print
      </button>
      <BottomSheet open={open} title="Print this book" onClose={() => setOpen(false)}>
        {choosing ? (
          <div className="sheet-stack">
            <p className="sheet-lead">Where will you print it?</p>
            <div className="choice-list" role="radiogroup" aria-label="Where to print">
              {PRINT_CHOICES.map((choice) => (
                <button
                  key={choice.mode}
                  type="button"
                  role="radio"
                  aria-checked={mode === choice.mode}
                  className={`choice${mode === choice.mode ? " is-selected" : ""}`}
                  onClick={() => setMode(choice.mode)}
                >
                  <b>{choice.title}</b>
                  <span>{choice.detail}</span>
                </button>
              ))}
            </div>
            <button className="btn primary" type="button" disabled={busy} onClick={make}>
              Make the PDF
            </button>
          </div>
        ) : null}

        {view && !choosing ? (
          <div className="sheet-stack">
            <p className="sheet-lead" role="status" aria-live="polite">
              {printProgressLabel(view)}
            </p>
            <div
              className="photo-import-meter"
              role="progressbar"
              aria-label="Making the PDF"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={percent}
            >
              <span style={{ width: `${percent}%` }} />
            </div>
            {view.status === "running" ? (
              <p className="muted">You can close this. The PDF keeps going.</p>
            ) : null}
            {view.status === "ready" ? (
              <>
                {view.mode === "shop" && view.lowRes.length ? (
                  <p className="muted" role="note">
                    {view.lowRes.length}{" "}
                    {view.lowRes.length === 1 ? "photo prints" : "photos print"} below 300 dpi and
                    may look soft (page{" "}
                    {[...new Set(view.lowRes.map((item: any) => item.page))].join(", ")}).
                  </p>
                ) : null}
                <a className="btn primary" href={view.downloadUrl} download>
                  Download PDF {megabytes(view.bytes)}
                </a>
                <button className="btn" type="button" onClick={reset}>
                  Make another
                </button>
              </>
            ) : null}
          </div>
        ) : null}

        {view?.status === "failed" ? (
          <p className="muted import-error" role="alert">
            {view.error}
          </p>
        ) : null}
        {error ? (
          <p className="muted import-error" role="alert">
            {error}
          </p>
        ) : null}
      </BottomSheet>
    </>
  );
}
