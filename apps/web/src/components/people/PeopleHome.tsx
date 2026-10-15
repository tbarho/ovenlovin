"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import type { Person, PersonRule, Preference } from "@ovenlovin/core";
import { api } from "@/lib/browser-api";
import { summarizePeople } from "@/lib/people-summary";
import {
  AVATAR_COLORS,
  AVATAR_EMOJIS,
  writePersonNotes,
  type PersonAppearance,
} from "@/lib/person-appearance";
import { PeopleReorder } from "./PeopleReorder";
import { PersonCard } from "./PersonCard";
import { Avatar, EmptyState, Sheet } from "./ui";

const EMPTY_LOVES: Preference[] = [];

function AddPersonForm({ onAdded }: { onAdded: () => void }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState<(typeof AVATAR_EMOJIS)[number]>("🧑‍🍳");
  const [color, setColor] = useState<(typeof AVATAR_COLORS)[number]>(AVATAR_COLORS[0] ?? "#e07a3d");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit() {
    const trimmed = name.trim();
    if (!trimmed) return;
    setPending(true);
    setError(null);
    try {
      const appearance: PersonAppearance = { emoji, color };
      await api<Person>("/api/v1/people", {
        method: "POST",
        body: JSON.stringify({
          displayName: trimmed,
          notes: writePersonNotes(appearance),
        }),
      });
      setName("");
      router.refresh();
      onAdded();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add person");
    } finally {
      setPending(false);
    }
  }

  return (
    <form
      className="olp-add-person"
      onSubmit={(event) => {
        event.preventDefault();
        void onSubmit();
      }}
    >
      <label className="olp-field">
        Name
        <input
          key="add-person-name"
          value={name}
          autoComplete="off"
          placeholder="Name"
          onChange={(event) => setName(event.target.value)}
        />
      </label>
      <div className="olp-identity-preview">
        <Avatar name={name || "?"} appearance={{ emoji, color }} size={44} />
      </div>
      <div className="olp-emoji-grid">
        {AVATAR_EMOJIS.map((item) => (
          <button
            key={item}
            type="button"
            className={emoji === item ? "is-on" : undefined}
            onClick={() => setEmoji(item)}
            aria-label={`Use ${item}`}
          >
            {item}
          </button>
        ))}
      </div>
      <div className="olp-color-grid">
        {AVATAR_COLORS.map((item) => (
          <button
            key={item}
            type="button"
            className={color === item ? "is-on" : undefined}
            style={{ background: item }}
            onClick={() => setColor(item)}
            aria-label={`Use color ${item}`}
          />
        ))}
      </div>
      {error ? <p className="olp-muted">{error}</p> : null}
      <button type="submit" className="olp-btn olp-btn-primary" disabled={!name.trim() || pending}>
        {pending ? "Adding…" : "Save"}
      </button>
    </form>
  );
}

function AddPersonLauncher() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        className="olp-add-person-launch"
        data-testid="add-person-launch"
        onClick={() => setOpen(true)}
      >
        Add person
      </button>
      <Sheet open={open} title="Add person" onClose={() => setOpen(false)}>
        <AddPersonForm onAdded={() => setOpen(false)} />
      </Sheet>
    </>
  );
}

export function PeopleHome({
  householdName,
  people,
  rules,
  loves = EMPTY_LOVES,
}: {
  householdName: string;
  people: Person[];
  rules: PersonRule[];
  loves?: Preference[];
}) {
  const router = useRouter();
  const summary = useMemo(() => summarizePeople(people, rules), [people, rules]);
  const rulesByPerson = useMemo(() => {
    const map = new Map<string, PersonRule[]>();
    for (const rule of rules) {
      const list = map.get(rule.personId) ?? [];
      list.push(rule);
      map.set(rule.personId, list);
    }
    return map;
  }, [rules]);
  const lovesByPerson = useMemo(() => {
    const map = new Map<string, Preference[]>();
    for (const item of loves) {
      const list = map.get(item.personId) ?? [];
      list.push(item);
      map.set(item.personId, list);
    }
    return map;
  }, [loves]);

  return (
    <div className="olp kitchen-people">
      <div className="olp-stack">
        <header>
          <h1>{householdName}</h1>
          <p className="olp-lead" data-testid="household-summary">
            {summary.line}
            {summary.badge ? (
              <>
                {" · "}
                <span data-testid="severe-badge">{summary.badge}</span>
              </>
            ) : null}
          </p>
        </header>

        {people.length === 0 ? (
          <EmptyState title="No one yet" body="Add a name and avatar." />
        ) : (
          <PeopleReorder
            people={people}
            renderPerson={(person, handle) => (
              <PersonCard
                person={person}
                rules={rulesByPerson.get(person.id) ?? []}
                loves={lovesByPerson.get(person.id) ?? []}
                handle={handle}
              />
            )}
            onReorder={async (personIds) => {
              await api("/api/v1/people/reorder", {
                method: "POST",
                body: JSON.stringify({ personIds }),
              });
              router.refresh();
            }}
          />
        )}

        <AddPersonLauncher />
      </div>
    </div>
  );
}
