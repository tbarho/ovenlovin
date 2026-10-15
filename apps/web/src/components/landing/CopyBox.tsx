"use client";

import { useState } from "react";
import { maskSecret } from "@/lib/mask-secret";

const COPIED_MS = 2000;

export function CopyBox({
  label,
  content,
  secret = false,
}: {
  label: string;
  content: string;
  secret?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [copyError, setCopyError] = useState<string | null>(null);
  const shown = secret && !revealed ? maskSecret(content) : content;

  async function onCopy() {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setCopyError(null);
      window.setTimeout(() => setCopied(false), COPIED_MS);
    } catch {
      setCopyError("Could not copy. Select the text instead.");
    }
  }

  return (
    <div className={`copy-box${secret ? " is-secret" : ""}`}>
      <header>
        <span>{label}</span>
        <div className="copy-box-actions">
          {secret ? (
            <button type="button" className="copy-btn" onClick={() => setRevealed((open) => !open)}>
              {revealed ? "Hide" : "Reveal"}
            </button>
          ) : null}
          <button type="button" className="copy-btn" onClick={() => void onCopy()}>
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
      </header>
      <pre>{shown}</pre>
      <p className="copy-status" role="status" aria-live="polite">
        {copied ? "Copied to clipboard" : copyError}
      </p>
    </div>
  );
}
