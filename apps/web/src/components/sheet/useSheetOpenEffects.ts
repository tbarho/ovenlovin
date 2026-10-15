"use client";

import { useEffect, useRef, type RefObject } from "react";

/** Editable fields only - never the sheet Close control or backdrop. */
export const SHEET_TEXT_FIELD_SELECTOR = [
  "input:not([type='hidden']):not([type='button']):not([type='submit']):not([type='reset']):not([type='file']):not([disabled])",
  "textarea:not([disabled])",
  "select:not([disabled])",
].join(", ");

/**
 * Body scroll lock, Escape-to-close, and one-shot autofocus when a sheet opens.
 *
 * Autofocus and listeners are keyed only on `open`. Callers almost always pass
 * an inline `onClose`, so putting that in the effect deps re-runs after every
 * keystroke and steals focus (usually to the Close button).
 */
export function useSheetOpenEffects({
  open,
  onClose,
  panelRef,
}: {
  open: boolean;
  onClose: () => void;
  panelRef: RefObject<HTMLElement | null>;
}) {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    const previousHtmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";

    const panel = panelRef.current;
    const field = panel?.querySelector<HTMLElement>(SHEET_TEXT_FIELD_SELECTOR);
    if (field) {
      field.focus({ preventScroll: true });
    } else {
      panel?.focus({ preventScroll: true });
    }

    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onCloseRef.current();
    }
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.documentElement.style.overflow = previousHtmlOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, panelRef]);
}
