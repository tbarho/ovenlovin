"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useId, useRef, type ReactNode } from "react";
import type { RuleUiBucket } from "@ovenlovin/allergens";
import { FoodIcon } from "@/components/prototype/people/icons";
import { useSheetOpenEffects } from "@/components/sheet/useSheetOpenEffects";
import { iconIdForTarget } from "@/lib/people-catalog";
import type { PersonAppearance } from "@/lib/person-appearance";

export type EatMark = "ok" | "warn" | "block";

export function Avatar({
  name,
  appearance,
  size = 40,
  mark,
}: {
  name: string;
  appearance: PersonAppearance;
  size?: number;
  mark?: EatMark;
}) {
  return (
    <span className="olp-avatar-wrap" style={{ width: size, height: size }}>
      <span
        className="olp-avatar"
        style={{
          width: size,
          height: size,
          background: appearance.color,
          fontSize: size * 0.46,
        }}
        aria-hidden="true"
      >
        {appearance.emoji || name.slice(0, 1)}
      </span>
      {mark ? <MarkBadge mark={mark} /> : null}
    </span>
  );
}

export function MarkBadge({ mark }: { mark: EatMark }) {
  return (
    <motion.span
      className={`olp-mark olp-mark-${mark}`}
      aria-hidden="true"
      key={mark}
      initial={{ scale: 0.7, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: "spring", stiffness: 420, damping: 18 }}
    >
      {mark === "ok" ? "✓" : mark === "warn" ? "!" : "✕"}
    </motion.span>
  );
}

export function Chip({
  label,
  target,
  bucket,
  onClick,
  onRemove,
}: {
  label: string;
  target?: string;
  bucket: RuleUiBucket;
  onClick?: () => void;
  onRemove?: () => void;
}) {
  return (
    <motion.div
      layout
      className={`olp-chip olp-chip-${bucket}`}
      initial={{ scale: 0.86, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0.9, opacity: 0 }}
      transition={{ type: "spring", stiffness: 420, damping: 22 }}
    >
      <div className="olp-chip-drag">
        {onClick ? (
          <button type="button" className="olp-chip-main" onClick={onClick}>
            {target ? <FoodIcon id={iconIdForTarget(target)} size={16} /> : null}
            {label}
          </button>
        ) : (
          <span className="olp-chip-main">
            {target ? <FoodIcon id={iconIdForTarget(target)} size={16} /> : null}
            {label}
          </span>
        )}
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
        <FoodIcon id="vegetarian" size={36} />
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
  const panelRef = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();

  useSheetOpenEffects({ open, onClose, panelRef });

  return (
    <AnimatePresence>
      {open ? (
        <div key="people-sheet" className="olp-sheet-root" data-sheet="people">
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
            ref={panelRef}
            className="olp-sheet"
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            tabIndex={-1}
            initial={reduce ? { y: 0 } : { y: 28 }}
            animate={{ y: 0, opacity: 1 }}
            exit={reduce ? { y: 0 } : { y: 28 }}
            transition={{ type: "spring", damping: 28, stiffness: 340 }}
            style={{ opacity: 1 }}
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
  pending,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  title: string;
  body: string;
  confirmLabel: string;
  pending?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <Sheet open={open} title={title} onClose={onCancel}>
      <p className="olp-lead">{body}</p>
      <div className="olp-row-end">
        <button type="button" className="olp-btn" onClick={onCancel} disabled={pending}>
          Cancel
        </button>
        <button
          type="button"
          className="olp-btn olp-btn-danger"
          onClick={onConfirm}
          disabled={pending}
        >
          {pending ? "Working…" : confirmLabel}
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
