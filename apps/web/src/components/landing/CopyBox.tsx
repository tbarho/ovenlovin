"use client";

import { useState } from "react";

export function CopyBox({ label, content }: { label: string; content: string }) {
  const [copied, setCopied] = useState(false);

  async function onCopy() {
    await navigator.clipboard.writeText(content);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  return (
    <div className="copy-box">
      <header>
        <span>{label}</span>
        <button type="button" className="copy-btn" onClick={onCopy}>
          {copied ? "Copied" : "Copy"}
        </button>
      </header>
      <pre>{content}</pre>
    </div>
  );
}
