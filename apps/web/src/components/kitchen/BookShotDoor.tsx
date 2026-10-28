"use client";

import Link from "next/link";
import { useState } from "react";
import { addPaperBook, type PaperBookResult } from "@/lib/book-import-client";
import { BottomSheet } from "./BottomSheet";
import { PhotoPick } from "./PhotoPick";

const LEAD =
  "Photograph the contents or index pages. We'll read them like we read a PDF's contents.";

/**
 * The paper-book door: pick the book's name and its contents photos, then the
 * same contents map and picks as a PDF gets. No file upload, so the meter is
 * indeterminate while the pages are read.
 */
export function BookShotDoor() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [step, setStep] = useState<"idle" | "reading" | "done" | "error">("idle");
  const [result, setResult] = useState<PaperBookResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function read() {
    if (files.length === 0) return;
    setStep("reading");
    setError(null);
    try {
      setResult(await addPaperBook(name.trim() || "Cookbook", files, () => undefined));
      setStep("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "We could not read those photos. Try again.");
      setStep("error");
    }
  }

  return (
    <>
      <p>
        <button className="btn" type="button" onClick={() => setOpen(true)}>
          Add a paper cookbook
        </button>
      </p>
      <BottomSheet
        open={open}
        title="Add a paper cookbook"
        onClose={() => {
          if (step === "reading") return;
          setOpen(false);
        }}
      >
        {step === "reading" ? (
          <div className="sheet-stack">
            <p className="sheet-lead" role="status" aria-live="polite">
              Reading {files.length} {files.length === 1 ? "page" : "pages"}
            </p>
            <div
              className="photo-import-meter is-indeterminate"
              role="progressbar"
              aria-label="Reading"
            >
              <span />
            </div>
          </div>
        ) : null}
        {step === "done" && result ? (
          <div className="sheet-stack">
            <p className="sheet-lead" role="status">
              Got the contents. Pick the recipes you want from the book.
            </p>
            <Link className="btn primary" href={`/recipes/books/${result.jobId}`}>
              Pick recipes
            </Link>
          </div>
        ) : null}
        {step === "idle" || step === "error" ? (
          <div className="sheet-stack">
            <p className="sheet-lead">{LEAD}</p>
            <label className="field">
              <span className="field-label">Book title</span>
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="The title on the cover"
                maxLength={200}
              />
            </label>
            <PhotoPick files={files} onChange={setFiles} />
            <button
              className="btn primary"
              type="button"
              disabled={files.length === 0}
              onClick={read}
            >
              Read the contents
            </button>
          </div>
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
