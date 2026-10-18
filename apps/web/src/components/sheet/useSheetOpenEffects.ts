"use client";

import { useEffect, useRef, type RefObject } from "react";

/** Editable fields only - never the sheet Close control or backdrop. */
export const SHEET_TEXT_FIELD_SELECTOR = [
  "input:not([type='hidden']):not([type='button']):not([type='submit']):not([type='reset']):not([type='file']):not([disabled])",
  "textarea:not([disabled])",
  "select:not([disabled])",
].join(", ");

export const SHEET_FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "textarea:not([disabled])",
  "input:not([type='hidden']):not([disabled])",
  "select:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(", ");

export function getSheetFocusableElements(panel: HTMLElement): HTMLElement[] {
  return Array.from(panel.querySelectorAll<HTMLElement>(SHEET_FOCUSABLE_SELECTOR)).filter((el) => {
    if (el.tabIndex < 0) return false;
    const style = window.getComputedStyle(el);
    return (
      style.display !== "none" && style.visibility !== "hidden" && style.visibility !== "collapse"
    );
  });
}

/**
 * Body scroll lock, Escape-to-close, focus trap, restore-focus, and one-shot
 * autofocus when a sheet opens.
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
    const previousFocus =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
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
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab" || !panel) return;
      const focusable = getSheetFocusableElements(panel);
      if (focusable.length === 0) {
        event.preventDefault();
        panel.focus({ preventScroll: true });
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!first || !last) return;
      const active = document.activeElement;
      if (event.shiftKey) {
        if (active === first || !panel.contains(active)) {
          event.preventDefault();
          last.focus({ preventScroll: true });
        }
      } else if (active === last || !panel.contains(active)) {
        event.preventDefault();
        first.focus({ preventScroll: true });
      }
    }
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.documentElement.style.overflow = previousHtmlOverflow;
      window.removeEventListener("keydown", onKey);
      if (previousFocus?.isConnected) {
        previousFocus.focus({ preventScroll: true });
      }
    };
  }, [open, panelRef]);
}
