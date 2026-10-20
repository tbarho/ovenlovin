"use client";

import { BottomSheet } from "./BottomSheet";

export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel,
  pending,
  danger,
  error,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  title: string;
  body: string;
  confirmLabel: string;
  pending?: boolean;
  danger?: boolean;
  error?: string | null;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <BottomSheet open={open} title={title} onClose={onCancel}>
      <p className="sheet-lead">{body}</p>
      {error ? <p className="muted">{error}</p> : null}
      <div className="sheet-actions">
        <button type="button" className="btn" onClick={onCancel} disabled={pending}>
          Cancel
        </button>
        <button
          type="button"
          className={`btn ${danger ? "danger" : "primary"}`}
          onClick={onConfirm}
          disabled={pending}
        >
          {pending ? "Working…" : confirmLabel}
        </button>
      </div>
    </BottomSheet>
  );
}
