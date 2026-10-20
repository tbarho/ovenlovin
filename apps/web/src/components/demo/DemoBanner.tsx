"use client";

import { useEffect, useState } from "react";
import { VERCEL_DEPLOY_URL } from "@ovenlovin/brand";
import { ConfirmDialog } from "@/components/kitchen/ConfirmDialog";

const STORAGE_KEY = "ovenlovin.demo-banner.dismissed";
const RESET_FAILED = "Could not reset this kitchen. Try again.";

export function DemoBanner() {
  const [hidden, setHidden] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [pendingReset, setPendingReset] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);

  useEffect(() => {
    if (window.sessionStorage.getItem(STORAGE_KEY) === "1") setHidden(true);
  }, []);

  async function resetKitchen() {
    setPendingReset(true);
    setResetError(null);
    try {
      const response = await fetch("/api/demo/reset", { method: "POST", credentials: "include" });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        setResetError(body?.error ?? RESET_FAILED);
        return;
      }
      window.location.assign("/recipes");
    } catch {
      setResetError(RESET_FAILED);
    } finally {
      setPendingReset(false);
    }
  }

  if (hidden) return null;

  return (
    <div className="demo-banner" role="status">
      <span>
        <strong>Demo, resets daily</strong>
        <span className="demo-banner-copy"> Your sandbox lasts about 24 hours.</span>
      </span>
      <div className="demo-banner-actions">
        <a className="btn primary demo-banner-cta" href={VERCEL_DEPLOY_URL}>
          Deploy your own
        </a>
        <button
          type="button"
          className="demo-banner-dismiss"
          onClick={() => {
            window.sessionStorage.setItem(STORAGE_KEY, "1");
            setHidden(true);
          }}
        >
          Dismiss
        </button>
        <button type="button" className="demo-banner-reset" onClick={() => setConfirmReset(true)}>
          Reset kitchen
        </button>
      </div>
      <ConfirmDialog
        open={confirmReset}
        title="Reset this kitchen?"
        body="This replaces your sandbox with a fresh sample kitchen. Edits in this demo will be gone."
        confirmLabel="Reset kitchen"
        danger
        pending={pendingReset}
        error={resetError}
        onCancel={() => {
          if (pendingReset) return;
          setConfirmReset(false);
          setResetError(null);
        }}
        onConfirm={() => {
          void resetKitchen();
        }}
      />
    </div>
  );
}
