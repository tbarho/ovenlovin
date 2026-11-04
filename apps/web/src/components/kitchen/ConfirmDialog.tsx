"use client";

import { Button, Hint } from "@/components/ui";
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
      {error ? <Hint tone="error">{error}</Hint> : null}
      <div className="sheet-actions">
        <Button type="button" variant="secondary" onClick={onCancel} disabled={pending}>
          Cancel
        </Button>
        <Button
          type="button"
          variant={danger ? "error" : "default"}
          onClick={onConfirm}
          loading={pending}
        >
          {confirmLabel}
        </Button>
      </div>
    </BottomSheet>
  );
}
