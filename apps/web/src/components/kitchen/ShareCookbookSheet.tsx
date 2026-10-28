"use client";

import { useState } from "react";
import { api } from "@/lib/browser-api";
import { BottomSheet } from "./BottomSheet";

export type CookbookShare = { path: string | null; blocked: string | null };

/** Unlisted reader link: make it, copy it, or stop sharing (the old link 404s). */
export function ShareCookbookSheet({
  cookbookId,
  share,
  open,
  onClose,
  onChange,
}: {
  cookbookId: string;
  share: CookbookShare;
  open: boolean;
  onClose: () => void;
  onChange: (share: CookbookShare) => void;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const url =
    share.path && typeof window !== "undefined" ? `${window.location.origin}${share.path}` : "";

  async function run(work: () => Promise<CookbookShare>) {
    setPending(true);
    setError(null);
    setCopied(false);
    try {
      onChange(await work());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update sharing");
    } finally {
      setPending(false);
    }
  }

  const create = () =>
    run(() => api<CookbookShare>(`/api/v1/cookbooks/${cookbookId}/share`, { method: "POST" }));

  const revoke = () =>
    run(async () => {
      await api(`/api/v1/cookbooks/${cookbookId}/share`, { method: "DELETE" });
      return { path: null, blocked: null };
    });

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      setError("Could not copy. Select the link and copy it.");
    }
  }

  return (
    <BottomSheet open={open} title="Share book" onClose={onClose}>
      <div className="form-card share-sheet" style={{ margin: 0 }}>
        <p className="muted">
          Anyone with the link can read this book without signing in. They cannot edit it or see the
          rest of your kitchen.
        </p>
        {share.path ? (
          <>
            <input
              aria-label="Share link"
              value={url}
              readOnly
              onFocus={(event) => event.currentTarget.select()}
            />
            <div className="recipe-actions" style={{ margin: 0 }}>
              <button className="btn primary" type="button" onClick={copy}>
                {copied ? "Copied" : "Copy link"}
              </button>
              <button className="btn" type="button" disabled={pending} onClick={revoke}>
                {pending ? "Stopping…" : "Stop sharing"}
              </button>
            </div>
          </>
        ) : (
          <button className="btn primary" type="button" disabled={pending} onClick={create}>
            {pending ? "Making link…" : "Create link"}
          </button>
        )}
        {error ? (
          <p className="muted" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    </BottomSheet>
  );
}
