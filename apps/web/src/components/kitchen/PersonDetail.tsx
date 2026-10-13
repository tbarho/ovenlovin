"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import type { Person, PersonRule } from "@ovenlovin/core";
import { PersonEditor } from "./PersonEditor";
import { RuleList } from "./RuleList";
import { RuleSheet } from "./RuleSheet";

export function PersonDetail({ person, rules }: { person: Person; rules: PersonRule[] }) {
  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const closeAdd = useCallback(() => setAddOpen(false), []);
  const closeEdit = useCallback(() => setEditOpen(false), []);

  return (
    <>
      <div className="kitchen-head">
        <div>
          <Link href="/people" className="muted">
            ← People
          </Link>
          <h1>{person.displayName}</h1>
          <p className="muted">Every warning names this person, the rule, and the ingredient.</p>
        </div>
        <div className="person-card-actions">
          <button type="button" className="btn ghost" onClick={() => setEditOpen(true)}>
            Edit person
          </button>
          <button type="button" className="btn primary" onClick={() => setAddOpen(true)}>
            Add a rule
          </button>
        </div>
      </div>
      <RuleList person={person} rules={rules} />
      <RuleSheet person={person} open={addOpen} onClose={closeAdd} />
      <PersonEditor person={person} ruleCount={rules.length} open={editOpen} onClose={closeEdit} />
    </>
  );
}
