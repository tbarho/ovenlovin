export type VisualViewportLike = {
  height: number;
  offsetTop: number;
};

export function visualViewportBox(
  view: VisualViewportLike | null | undefined,
  fallbackHeight: number
): { height: number; top: number } {
  return {
    height: view?.height ?? fallbackHeight,
    top: view?.offsetTop ?? 0,
  };
}

export function applySheetViewportVars(
  root: Pick<HTMLElement, "style">,
  box: { height: number; top: number }
) {
  root.style.setProperty("--sheet-vv-height", `${box.height}px`);
  root.style.setProperty("--sheet-vv-top", `${box.top}px`);
}

export function fieldNeedsScroll(
  field: Pick<DOMRect, "top" | "bottom">,
  scroller: Pick<DOMRect, "top" | "bottom">,
  padding = 16
): boolean {
  return field.top < scroller.top + padding || field.bottom > scroller.bottom - padding;
}

export function scrollFieldIntoScroller(field: HTMLElement, scroller: HTMLElement | null) {
  if (!scroller) {
    field.scrollIntoView({ block: "nearest", inline: "nearest" });
    return;
  }

  const fieldRect = field.getBoundingClientRect();
  const scrollerRect = scroller.getBoundingClientRect();
  if (!fieldNeedsScroll(fieldRect, scrollerRect)) return;

  const fieldCenter = fieldRect.top + fieldRect.height / 2;
  const scrollerCenter = scrollerRect.top + scrollerRect.height / 2;
  scroller.scrollTop += fieldCenter - scrollerCenter;
}
