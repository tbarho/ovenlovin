"use client";

import { useEffect, type RefObject } from "react";
import { SHEET_TEXT_FIELD_SELECTOR } from "./useSheetOpenEffects";
import {
  applySheetViewportVars,
  scrollFieldIntoScroller,
  visualViewportBox,
} from "./sheet-viewport";

/**
 * Size the open sheet to the visual viewport (iOS keyboard) and keep the
 * focused field inside `.sheet-body`. Keyed only on `open` so it cannot
 * re-run on parent re-renders the way an inline `onClose` would.
 */
export function useSheetViewport({
  open,
  rootRef,
  panelRef,
}: {
  open: boolean;
  rootRef: RefObject<HTMLElement | null>;
  panelRef: RefObject<HTMLElement | null>;
}) {
  useEffect(() => {
    if (!open) return;

    const root = rootRef.current;
    const panel = panelRef.current;
    if (!root) return;

    const sync = () => {
      applySheetViewportVars(
        root,
        visualViewportBox(
          window.visualViewport
            ? {
                height: window.visualViewport.height,
                offsetTop: window.visualViewport.offsetTop,
              }
            : undefined,
          window.innerHeight
        )
      );

      const active = document.activeElement;
      if (
        !(active instanceof HTMLElement) ||
        !panel?.contains(active) ||
        !active.matches(SHEET_TEXT_FIELD_SELECTOR)
      ) {
        return;
      }
      scrollFieldIntoScroller(active, panel.querySelector<HTMLElement>(".sheet-body"));
    };

    sync();

    const vv = window.visualViewport;
    vv?.addEventListener("resize", sync);
    vv?.addEventListener("scroll", sync);
    window.addEventListener("resize", sync);

    const onFocusIn = (event: FocusEvent) => {
      const target = event.target;
      if (!(target instanceof HTMLElement) || !target.matches(SHEET_TEXT_FIELD_SELECTOR)) return;
      requestAnimationFrame(() => {
        scrollFieldIntoScroller(target, panel?.querySelector<HTMLElement>(".sheet-body") ?? null);
      });
    };
    panel?.addEventListener("focusin", onFocusIn);

    return () => {
      vv?.removeEventListener("resize", sync);
      vv?.removeEventListener("scroll", sync);
      window.removeEventListener("resize", sync);
      panel?.removeEventListener("focusin", onFocusIn);
    };
  }, [open, rootRef, panelRef]);
}
