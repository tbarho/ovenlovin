"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const STORAGE_KEY = "ovenlovin.first-run-v1";

export function KitchenTour() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(window.localStorage.getItem(STORAGE_KEY) !== "1");
  }, []);

  if (!open) return null;

  return (
    <aside className="kitchen-tour" role="region" aria-label="Getting started">
      <div>
        <h2>Start your kitchen</h2>
        <ol>
          <li>
            <Link href="/people">Add your people</Link> first — their rules drive every warning.
          </li>
          <li>Import a recipe you already cook.</li>
          <li>
            <Link href="/plans">Plan the week</Link> and shop from that list.
          </li>
        </ol>
      </div>
      <button
        type="button"
        className="btn compact"
        onClick={() => {
          window.localStorage.setItem(STORAGE_KEY, "1");
          setOpen(false);
        }}
      >
        Got it
      </button>
    </aside>
  );
}
