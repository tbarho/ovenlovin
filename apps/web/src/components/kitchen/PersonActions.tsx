"use client";

import { useState } from "react";
import type { Person } from "@ovenlovin/core";
import { PersonEditor } from "./PersonEditor";

export function PersonActions({ person, ruleCount }: { person: Person; ruleCount: number }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button type="button" className="btn ghost compact" onClick={() => setOpen(true)}>
        Edit
      </button>
      <PersonEditor
        person={person}
        ruleCount={ruleCount}
        open={open}
        onClose={() => setOpen(false)}
      />
    </>
  );
}
