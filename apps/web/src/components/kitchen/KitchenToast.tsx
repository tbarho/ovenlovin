"use client";

import { useEffect } from "react";

const TOAST_MS = 9000;

export function KitchenToast({
  message,
  actionLabel,
  onUndo,
  onDismiss,
  durationMs = TOAST_MS,
}: {
  message: string | null;
  actionLabel?: string;
  onUndo?: () => void;
  onDismiss: () => void;
  durationMs?: number;
}) {
  useEffect(() => {
    if (!message || actionLabel) return;
    const timer = window.setTimeout(onDismiss, durationMs);
    return () => window.clearTimeout(timer);
  }, [message, onDismiss, actionLabel, durationMs]);

  if (!message) return null;

  return (
    <div className="kitchen-toast" role={actionLabel ? "alert" : "status"}>
      <span>{message}</span>
      {onUndo ? (
        <button type="button" className="hit44-y" onClick={onUndo}>
          {actionLabel ?? "Undo"}
        </button>
      ) : null}
      <button type="button" className="hit44-y" onClick={onDismiss}>
        Dismiss
      </button>
    </div>
  );
}
