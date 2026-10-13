"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import type { Person, PersonRule } from "@ovenlovin/core";
import { describeRuleChip, describeSharedFacility, ruleRemovalCopy } from "@ovenlovin/allergens";
import { api } from "@/lib/browser-api";
import { ConfirmDialog } from "./ConfirmDialog";
import { RuleChip } from "./RuleChip";
import { RuleSheet } from "./RuleSheet";

export function RuleList({ person, rules }: { person: Person; rules: PersonRule[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<PersonRule | null>(null);
  const closeEdit = useCallback(() => setEditing(null), []);
  const [removing, setRemoving] = useState<PersonRule | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function remove() {
    if (!removing) return;
    setPending(true);
    setError(null);
    try {
      await api(`/api/v1/people/${person.id}/rules/${removing.id}`, { method: "DELETE" });
      setRemoving(null);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not remove rule");
    } finally {
      setPending(false);
    }
  }

  if (rules.length === 0) {
    return (
      <p className="empty-note">No rules yet. Add one to start checking meals for this person.</p>
    );
  }

  return (
    <>
      <div className="rule-list">
        {rules.map((rule) => {
          const chip = describeRuleChip(rule);
          const facility = describeSharedFacility(rule.sharedFacility);
          return (
            <div className="rule" key={rule.id}>
              <div>
                <RuleChip text={chip.text} severity={chip.severity} />
                <p>
                  {person.displayName}: {chip.text}
                </p>
                {facility ? <p className="muted">{facility}</p> : null}
                {rule.note ? <p className="muted">{rule.note}</p> : null}
              </div>
              <div className="rule-actions">
                <button
                  type="button"
                  className="btn ghost compact"
                  onClick={() => setEditing(rule)}
                >
                  Edit
                </button>
                <button
                  type="button"
                  className="btn ghost compact"
                  onClick={() => setRemoving(rule)}
                >
                  Remove
                </button>
              </div>
            </div>
          );
        })}
      </div>
      {error ? <p className="form-error">{error}</p> : null}
      <RuleSheet person={person} rule={editing} open={Boolean(editing)} onClose={closeEdit} />
      <ConfirmDialog
        open={Boolean(removing)}
        title={removing ? ruleRemovalCopy(person.displayName, removing).title : "Remove this rule?"}
        body={removing ? ruleRemovalCopy(person.displayName, removing).body : ""}
        confirmLabel="Remove rule"
        danger
        pending={pending}
        onCancel={() => setRemoving(null)}
        onConfirm={remove}
      />
    </>
  );
}
