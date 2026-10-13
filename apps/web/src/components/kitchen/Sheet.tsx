"use client";

import { useEffect } from "react";

export function Sheet({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="sheet-root" role="dialog" aria-modal="true" aria-label={title}>
      <button className="sheet-backdrop" type="button" aria-label="Close" onClick={onClose} />
      <div className="sheet-panel">
        <div className="sheet-handle" />
        <header>
          <h2>{title}</h2>
          <button className="btn ghost" type="button" onClick={onClose}>
            Done
          </button>
        </header>
        <div className="sheet-body">{children}</div>
      </div>
    </div>
  );
}
