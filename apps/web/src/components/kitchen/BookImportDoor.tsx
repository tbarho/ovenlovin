"use client";

import { useState } from "react";
import {
  addBook,
  bookDoneLabel,
  bookUploadLabel,
  type BookImportResult,
  type BookStep,
} from "@/lib/book-import-client";
import { BottomSheet } from "./BottomSheet";

function BookProgress({ step }: { step: BookStep }) {
  if (step.phase !== "uploading") {
    return (
      <div className="sheet-stack">
        <p className="sheet-lead" role="status" aria-live="polite">
          {step.phase === "checking" ? "Checking the file" : "Saving the book"}
        </p>
        <div
          className="photo-import-meter is-indeterminate"
          role="progressbar"
          aria-label="Working"
        >
          <span />
        </div>
      </div>
    );
  }
  const percent = step.total ? Math.round((step.loaded / step.total) * 100) : 0;
  return (
    <div className="sheet-stack">
      <p className="sheet-lead" role="status" aria-live="polite">
        {bookUploadLabel(step.loaded, step.total)}
      </p>
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
    </div>
  );
}

export function BookImportDoor({ deps }: { deps?: Parameters<typeof addBook>[2] } = {}) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<BookStep | null>(null);
  const [result, setResult] = useState<BookImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function pick(file: File | undefined) {
    if (!file) return;
    setError(null);
    setResult(null);
    try {
      setResult(await addBook(file, setStep, deps));
    } catch (err) {
      setError(err instanceof Error ? err.message : "That upload did not work. Try again.");
    } finally {
      setStep(null);
    }
  }

  return (
    <>
      <p>
        <button className="btn" type="button" onClick={() => setOpen(true)}>
          Add a whole cookbook
        </button>
      </p>
      <BottomSheet
        open={open}
        title="Add a whole cookbook"
        onClose={() => {
          if (step) return;
          setOpen(false);
        }}
      >
        {step ? <BookProgress step={step} /> : null}
        {!step && result ? (
          <p className="sheet-lead" role="status">
            {bookDoneLabel(result)}
          </p>
        ) : null}
        {!step && !result ? (
          <div className="sheet-stack">
            <p className="sheet-lead">
              Drop in a PDF of the book. We&apos;ll read the contents first.
            </p>
            <label className="field">
              <span className="field-label">Cookbook PDF</span>
              <input
                type="file"
                accept="application/pdf,.pdf"
                onChange={(event) => pick(event.target.files?.[0])}
              />
            </label>
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
