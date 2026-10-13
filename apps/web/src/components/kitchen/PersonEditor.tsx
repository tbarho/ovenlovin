"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Person } from "@ovenlovin/core";
import { personRemovalCopy } from "@ovenlovin/allergens";
import { api } from "@/lib/browser-api";
import { BottomSheet } from "./BottomSheet";
import { ConfirmDialog } from "./ConfirmDialog";

export function PersonEditor({
  person,
  ruleCount,
  open,
  onClose,
}: {
  person: Person;
  ruleCount: number;
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [displayName, setDisplayName] = useState(person.displayName);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setDisplayName(person.displayName);
      setError(null);
    }
  }, [open, person.displayName]);
  const [pending, setPending] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const removal = personRemovalCopy(person.displayName, ruleCount);

  async function save() {
    setPending(true);
    setError(null);
    try {
      await api(`/api/v1/people/${person.id}`, {
        method: "PATCH",
        body: JSON.stringify({ displayName }),
      });
      router.refresh();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update person");
    } finally {
      setPending(false);
    }
  }

  async function remove() {
    setPending(true);
    setError(null);
    try {
      await api(`/api/v1/people/${person.id}`, { method: "DELETE" });
      router.push("/people");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not remove person");
      setPending(false);
    }
  }

  return (
    <>
      <BottomSheet open={open && !confirmOpen} title="Edit person" onClose={onClose}>
        <label className="field">
          <span className="field-label">Name</span>
          <input
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            required
          />
        </label>
        {error ? <p className="form-error">{error}</p> : null}
        <div className="sheet-actions">
          <button type="button" className="btn danger-ghost" onClick={() => setConfirmOpen(true)}>
            Remove
          </button>
          <button
            type="button"
            className="btn primary"
            onClick={save}
            disabled={pending || displayName.trim().length === 0}
          >
            {pending ? "Saving…" : "Save"}
          </button>
        </div>
      </BottomSheet>
      <ConfirmDialog
        open={confirmOpen}
        title={removal.title}
        body={removal.body}
        confirmLabel="Remove person"
        danger
        pending={pending}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={remove}
      />
    </>
  );
}
