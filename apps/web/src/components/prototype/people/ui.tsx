"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useEffect, useId, type DragEvent, type ReactNode } from "react";
import type { Bucket, Mark, Person } from "./model";

export function Avatar({
  person,
  size = 40,
  mark,
}: {
  person: Pick<Person, "name" | "emoji" | "color">;
  size?: number;
  mark?: Mark;
}) {
  return (
    <span className="olp-avatar-wrap" style={{ width: size, height: size }}>
      <span
        className="olp-avatar"
        style={{
          width: size,
          height: size,
          background: person.color,
          fontSize: size * 0.46,
        }}
        aria-hidden="true"
      >
        {person.emoji || person.name.slice(0, 1)}
      </span>
      {mark ? <MarkBadge mark={mark} /> : null}
    </span>
  );
}

export function MarkBadge({ mark }: { mark: Mark }) {
  return (
    <span className={`olp-mark olp-mark-${mark}`} aria-hidden="true">
      {mark === "ok" ? "✓" : mark === "warn" ? "!" : "✕"}
    </span>
  );
}

export function Chip({
  label,
  emoji,
  bucket,
  onClick,
  onRemove,
  draggable,
  onDragStart,
}: {
  label: string;
  emoji?: string;
  bucket: Bucket;
  onClick?: () => void;
  onRemove?: () => void;
  draggable?: boolean;
  onDragStart?: (event: DragEvent<HTMLDivElement>) => void;
}) {
  return (
    <motion.div layout className={`olp-chip olp-chip-${bucket}`}>
      <div className="olp-chip-drag" draggable={draggable} onDragStart={onDragStart}>
        <button type="button" className="olp-chip-main" onClick={onClick}>
          {emoji ? <span aria-hidden="true">{emoji}</span> : null}
          {label}
        </button>
        {onRemove ? (
          <button
            type="button"
            className="olp-chip-x"
            aria-label={`Remove ${label}`}
            onClick={(event) => {
              event.stopPropagation();
              onRemove();
            }}
          >
            ×
          </button>
        ) : null}
      </div>
    </motion.div>
  );
}

export function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <div className="olp-empty">
      <div className="olp-empty-art" aria-hidden="true">
        🍽️
      </div>
      <h3>{title}</h3>
      <p>{body}</p>
      {action}
    </div>
  );
}

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  label,
}: {
  value: T;
  onChange: (value: T) => void;
  options: Array<{ value: T; label: string }>;
  label: string;
}) {
  return (
    <div className="olp-seg" role="tablist" aria-label={label}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="tab"
          aria-selected={value === option.value}
          className={value === option.value ? "is-on" : undefined}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function Sheet({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const titleId = useId();
  const reduce = useReducedMotion();

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open ? (
        <div className="olp-sheet-root">
          <motion.button
            type="button"
            className="olp-sheet-backdrop"
            aria-label="Dismiss overlay"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />
          <motion.div
            className="olp-sheet"
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            initial={reduce ? { opacity: 0 } : { y: 24, opacity: 0 }}
            animate={reduce ? { opacity: 1 } : { y: 0, opacity: 1 }}
            exit={reduce ? { opacity: 0 } : { y: 24, opacity: 0 }}
            transition={{ type: "spring", damping: 26, stiffness: 320 }}
          >
            <div className="olp-sheet-handle" aria-hidden="true" />
            <header className="olp-sheet-head">
              <h2 id={titleId}>{title}</h2>
              <button type="button" className="olp-text-btn" onClick={onClose}>
                Close
              </button>
            </header>
            <div className="olp-sheet-body">{children}</div>
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>
  );
}

export function ConfirmSheet({
  open,
  title,
  body,
  confirmLabel,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  title: string;
  body: string;
  confirmLabel: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <Sheet open={open} title={title} onClose={onCancel}>
      <p className="olp-lead">{body}</p>
      <div className="olp-row-end">
        <button type="button" className="olp-btn" onClick={onCancel}>
          Cancel
        </button>
        <button type="button" className="olp-btn olp-btn-danger" onClick={onConfirm}>
          {confirmLabel}
        </button>
      </div>
    </Sheet>
  );
}

export function Toast({
  message,
  onUndo,
  onDismiss,
}: {
  message: string | null;
  onUndo?: () => void;
  onDismiss: () => void;
}) {
  return (
    <AnimatePresence>
      {message ? (
        <motion.div
          className="olp-toast"
          role="status"
          initial={{ y: 16, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 16, opacity: 0 }}
        >
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
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
