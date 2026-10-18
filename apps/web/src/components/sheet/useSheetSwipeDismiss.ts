"use client";

import { useEffect, useRef, type RefObject } from "react";

const CLOSE_DISTANCE_PX = 72;
const CLOSE_FLICK_PX = 28;
const CLOSE_VELOCITY = 0.45;

/**
 * Drag the open bottom sheet down to dismiss. Keyed only on `open` so an inline
 * `onClose` cannot rebind listeners while the pointer is down.
 */
export function useSheetSwipeDismiss({
  open,
  onClose,
  panelRef,
  enabled = false,
}: {
  open: boolean;
  onClose: () => void;
  panelRef: RefObject<HTMLElement | null>;
  enabled?: boolean;
}) {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open || !enabled) return;
    const node = panelRef.current;
    if (!node) return;
    const panel: HTMLElement = node;

    let dragging = false;
    let startY = 0;
    let lastY = 0;
    let lastT = 0;
    let dy = 0;
    let velocity = 0;

    function resetTransform() {
      panel.style.transform = "";
      panel.style.transition = "";
    }

    function isInteractive(target: EventTarget | null) {
      if (!(target instanceof HTMLElement)) return false;
      return Boolean(target.closest("a, button, input, textarea, select, [role='button']"));
    }

    function onPointerDown(event: PointerEvent) {
      if (event.pointerType === "mouse" && event.button !== 0) return;
      if (isInteractive(event.target)) return;
      const body = panel.querySelector<HTMLElement>(".sheet-body");
      if (
        body &&
        event.target instanceof Node &&
        body.contains(event.target) &&
        body.scrollTop > 0
      ) {
        return;
      }
      dragging = true;
      startY = event.clientY;
      lastY = event.clientY;
      lastT = event.timeStamp;
      dy = 0;
      velocity = 0;
      panel.style.transition = "none";
    }

    function onPointerMove(event: PointerEvent) {
      if (!dragging) return;
      dy = Math.max(0, event.clientY - startY);
      const dt = event.timeStamp - lastT || 1;
      velocity = (event.clientY - lastY) / dt;
      lastY = event.clientY;
      lastT = event.timeStamp;
      panel.style.transform = `translateY(${dy}px)`;
    }

    function onPointerUp() {
      if (!dragging) return;
      dragging = false;
      const shouldClose =
        dy >= CLOSE_DISTANCE_PX || (dy >= CLOSE_FLICK_PX && velocity >= CLOSE_VELOCITY);
      if (shouldClose) {
        onCloseRef.current();
        return;
      }
      panel.style.transition = "transform var(--motion-sheet) var(--motion-ease)";
      panel.style.transform = "translateY(0px)";
    }

    panel.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerUp);
    return () => {
      panel.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);
      resetTransform();
    };
  }, [open, enabled, panelRef]);
}
