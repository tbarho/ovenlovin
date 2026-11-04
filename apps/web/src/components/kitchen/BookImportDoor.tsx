"use client";

import Link from "next/link";
import { useState, type InputHTMLAttributes } from "react";
import { Button, Field } from "@/components/ui";
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

/** Native file control. Input has no file type; Field still wires the label. */
function CookbookPdfInput({
  invalid: _invalid,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }) {
  return <input type="file" accept="application/pdf,.pdf" {...props} />;
}

/** `blocked` (the public demo) disables the door up front; the sentence lives at `#books-blocked`. */
export function BookImportDoor({
  deps,
  blocked = null,
}: { deps?: Parameters<typeof addBook>[2]; blocked?: string | null } = {}) {
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
        <Button
          variant="secondary"
          disabled={Boolean(blocked)}
          aria-describedby={blocked ? "books-blocked" : undefined}
          onClick={() => setOpen(true)}
        >
          Add a whole cookbook
        </Button>
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
          <div className="sheet-stack">
            <p className="sheet-lead" role="status">
              {bookDoneLabel(result)}
            </p>
            <Link
              className="ds-button ds-button--default ds-button--md"
              href={`/recipes/books/${result.jobId}`}
            >
              Pick recipes
            </Link>
          </div>
        ) : null}
        {!step && !result ? (
          <div className="sheet-stack">
            <p className="sheet-lead">
              Drop in a PDF of the book. We&apos;ll read the contents first.
            </p>
            <Field label="Cookbook PDF">
              <CookbookPdfInput onChange={(event) => pick(event.target.files?.[0])} />
            </Field>
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
