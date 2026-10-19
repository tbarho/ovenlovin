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
    <div className="import-advanced">
      <p className="muted">
        Drag Save to OvenLovin onto your bookmarks bar. On a recipe page, open it to send the page
        from your browser.
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
          {copied ? "Copied" : "Copy code"}
        </button>
      </div>
      <p className="muted">
        Safari on iPhone can use an API key from Settings with the steps above.
      </p>
    </div>
  );
}
