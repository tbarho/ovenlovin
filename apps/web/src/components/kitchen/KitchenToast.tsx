"use client";

import { useEffect } from "react";

const TOAST_MS = 9000;

export function KitchenToast({
  message,
  onUndo,
  onDismiss,
}: {
  message: string | null;
  onUndo?: () => void;
  onDismiss: () => void;
}) {
  useEffect(() => {
    if (!message) return;
    const timer = window.setTimeout(onDismiss, TOAST_MS);
    return () => window.clearTimeout(timer);
  }, [message, onDismiss]);

  if (!message) return null;

  return (
    <div className="kitchen-toast" role="status">
      <span>{message}</span>
      {onUndo ? (
        <button type="button" onClick={onUndo}>
          Undo
        </button>
      ) : (
        <button type="button" onClick={onDismiss}>
          Dismiss
        </button>
      )}
    </div>
  );
}
