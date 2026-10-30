"use client";

import { useId, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useSheetOpenEffects } from "@/components/sheet/useSheetOpenEffects";
import { useSheetSwipeDismiss } from "@/components/sheet/useSheetSwipeDismiss";
import { useSheetViewport } from "@/components/sheet/useSheetViewport";

export function BottomSheet({
  open,
  title,
  onClose,
  onClosed,
  children,
  layout = "sheet",
  id,
  className,
  swipeToDismiss = false,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  /** After the sheet has closed and restored focus to its opener. */
  onClosed?: () => void;
  children: ReactNode;
  layout?: "sheet" | "picker";
  id?: string;
  className?: string;
  swipeToDismiss?: boolean;
}) {
  const titleId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useSheetOpenEffects({ open, onClose, onClosed, panelRef });
  useSheetViewport({ open, rootRef, panelRef });
  useSheetSwipeDismiss({ open, onClose, panelRef, enabled: swipeToDismiss });

  if (!open) return null;

  const tree = (
    <div
      ref={rootRef}
      className={["sheet-root", className].filter(Boolean).join(" ")}
      data-sheet={layout}
    >
      <button type="button" className="sheet-backdrop" aria-label="Close" onClick={onClose} />
      <div
        ref={panelRef}
        id={id}
        className="sheet-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
      >
        <div className="sheet-handle" aria-hidden="true" />
        <header className="sheet-head">
          <h2 id={titleId}>{title}</h2>
          <button type="button" className="sheet-close hit44" onClick={onClose}>
            Close
          </button>
        </header>
        <div className="sheet-body">{children}</div>
      </div>
    </div>
  );

  if (typeof document === "undefined") return tree;
  return createPortal(tree, document.body);
}
