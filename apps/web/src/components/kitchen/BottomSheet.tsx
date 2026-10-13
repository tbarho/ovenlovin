"use client";

import { useId, useRef, type ReactNode } from "react";
import { useSheetOpenEffects } from "@/components/sheet/useSheetOpenEffects";
import { useSheetViewport } from "@/components/sheet/useSheetViewport";

export function BottomSheet({
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
  const rootRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useSheetOpenEffects({ open, onClose, panelRef });
  useSheetViewport({ open, rootRef, panelRef });

  if (!open) return null;

  return (
    <div ref={rootRef} className="sheet-root" data-sheet="bottom">
      <button type="button" className="sheet-backdrop" aria-label="Close" onClick={onClose} />
      <div
        ref={panelRef}
        className="sheet-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
      >
        <div className="sheet-handle" aria-hidden="true" />
        <header className="sheet-head">
          <h2 id={titleId}>{title}</h2>
          <button type="button" className="sheet-close" onClick={onClose}>
            Close
          </button>
        </header>
        <div className="sheet-body">{children}</div>
      </div>
    </div>
  );
}
