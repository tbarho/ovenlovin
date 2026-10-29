"use client";

import { useEffect, useState } from "react";
import { elapsedLabel } from "@/lib/photo-import-client";

export type ImportProgressVariant = "link" | "caption" | "recipe";

const VARIANTS: Record<
  ImportProgressVariant,
  { id: string; label: string; state: "done" | "current" | "todo" }[]
> = {
  link: [
    { id: "find", label: "Finding the post", state: "current" },
    { id: "read", label: "Reading the caption", state: "todo" },
    { id: "ready", label: "Ready to review", state: "todo" },
  ],
  caption: [
    { id: "pasted", label: "Caption pasted", state: "done" },
    { id: "read", label: "Reading the caption", state: "current" },
    { id: "ready", label: "Ready to review", state: "todo" },
  ],
  recipe: [
    { id: "pasted", label: "Pasted recipe", state: "done" },
    { id: "read", label: "Reading the recipe", state: "current" },
    { id: "ready", label: "Ready to review", state: "todo" },
  ],
};

export function ImportProgress({
  variant,
  onCancel,
}: {
  variant: ImportProgressVariant;
  onCancel: () => void;
}) {
  const [now, setNow] = useState(() => Date.now());
  const [started] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);
  const steps = VARIANTS[variant];
  const current = steps.find((step) => step.state === "current") ?? steps[0]!;
  return (
    <div className="import-progress" data-testid="import-progress">
      <h3>Importing</h3>
      <p className="muted">Usually a few seconds. Long captions take longer.</p>
      <ol className="import-steps">
        {steps.map((step) => (
          <li key={step.id} className={step.state === "todo" ? undefined : `is-${step.state}`}>
            {step.label}
          </li>
        ))}
      </ol>
      <div
        className="import-meter"
        role="progressbar"
        aria-label="Importing"
        aria-valuetext="Working, no estimate"
      >
        <span />
      </div>
      <p className="import-progress-timer">
        {current.label} - {elapsedLabel(now - started)}
      </p>
      <button type="button" className="btn" onClick={onCancel}>
        Cancel
      </button>
    </div>
  );
}
