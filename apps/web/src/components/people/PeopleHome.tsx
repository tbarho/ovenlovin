"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import {
  RULE_UI_BUCKETS,
  displayNameForTarget,
  loveLabel,
  uiBucketForRule,
} from "@ovenlovin/allergens";
import type { Person, PersonRule, Preference } from "@ovenlovin/core";
import { api } from "@/lib/browser-api";
import { summarizePeople } from "@/lib/people-summary";
import {
  AVATAR_COLORS,
  AVATAR_EMOJIS,
  appearanceForPerson,
  writePersonNotes,
  type PersonAppearance,
} from "@/lib/person-appearance";
import { PeopleReorder } from "./PeopleReorder";
import { Avatar, Chip, EmptyState, type ChipBucket } from "./ui";

const CARD_LANES: Array<{ bucket: ChipBucket; label: string }> = [
  ...RULE_UI_BUCKETS,
  { bucket: "loves", label: "Loves" },
];

const EMPTY_LOVES: Preference[] = [];

function PersonCard({
  person,
  rules,
  loves,
}: {
  person: Person;
  rules: PersonRule[];
  loves: Preference[];
}) {
  const appearance = appearanceForPerson(person);
  const grouped = useMemo(() => {
    const map: Record<ChipBucket, Array<{ key: string; target: string; label: string }>> = {
      cant_eat: [],
      doesnt_like: [],
      loves: loves.map((item) => ({
        key: item.id,
        target: item.value,
        label: loveLabel(item.value),
      })),
    };
    for (const rule of rules) {
      map[uiBucketForRule(rule)].push({
        key: rule.id,
        target: rule.target,
        label: displayNameForTarget(rule.target),
      });
    }
    return map;
  }, [loves, rules]);

  return (
    <Link
      href={`/people/${person.id}`}
      className="olp-person-chip"
      data-testid={`person-chip-${person.id}`}
    >
      <Avatar name={person.displayName} appearance={appearance} size={48} />
      <span className="olp-person-card-body">
        <b>{person.displayName}</b>
        <span className="olp-person-card-lanes">
          {CARD_LANES.map((lane) => {
            const items = grouped[lane.bucket];
            return (
              <span
                key={lane.bucket}
                className={`olp-person-card-lane olp-person-card-lane-${lane.bucket}`}
                data-testid={`person-card-${lane.bucket}-${person.id}`}
              >
                <span className="olp-person-card-lane-label">{lane.label}</span>
                {items.length > 0 ? (
                  <span className="olp-passport">
                    {items.map((item) => (
                      <Chip
                        key={item.key}
                        target={item.target}
                        label={item.label}
                        bucket={lane.bucket}
                      />
                    ))}
                  </span>
                ) : (
                  <small>None</small>
                )}
              </span>
            );
          })}
        </span>
      </span>
    </Link>
  );
}

function AddPersonForm() {
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
        {pending ? "Adding…" : "Add person"}
      </button>
    </form>
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
            renderPerson={(person) => (
              <PersonCard
                person={person}
                rules={rulesByPerson.get(person.id) ?? []}
                loves={lovesByPerson.get(person.id) ?? []}
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

        <AddPersonForm />
      </div>
    </div>
  );
}
