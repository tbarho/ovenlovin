"use client";

import { useEffect, useRef, useState } from "react";
import { buildImportBookmarklet, importBookmarkletTitle } from "@/lib/import-bookmarklet";

export function ImportBookmarklet({ origin }: { origin?: string }) {
  const host =
    origin ?? (typeof window !== "undefined" ? window.location.origin : "http://localhost:3000");
  const href = buildImportBookmarklet(host);
  const title = importBookmarkletTitle();
  const [copied, setCopied] = useState(false);
  const linkRef = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    linkRef.current?.setAttribute("href", href);
  }, [href]);

  async function copyHref() {
    try {
      await navigator.clipboard.writeText(href);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="form-card import-bookmarklet">
      <h2>Save from your browser</h2>
      <p className="muted">
        Drag this onto your bookmarks bar. On a recipe page the importer cannot fetch, open the
        bookmark. It sends the page from your device and opens the saved recipe.
      </p>
      <div className="import-row">
        <a
          ref={linkRef}
          className="btn primary"
          href="#"
          onClick={(event) => event.preventDefault()}
        >
          {title}
        </a>
        <button type="button" className="btn" onClick={() => void copyHref()}>
          {copied ? "Copied" : "Copy bookmarklet"}
        </button>
      </div>
      <p className="muted">
        iPhone: Settings has an API key and a Shortcuts share-sheet recipe that does the same thing.
      </p>
    </div>
  );
}
