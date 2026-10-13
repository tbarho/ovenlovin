"use client";

import Link from "next/link";
import { useState } from "react";
import {
  AVATAR_COLORS,
  AVATAR_EMOJIS,
  newId,
  restrictionLabel,
  slugPersonName,
  summarizeHousehold,
  type Person,
} from "./model";
import { usePrototype } from "./store";
import { Avatar, Chip, EmptyState } from "./ui";

function PersonCard({ person }: { person: Person }) {
  return (
    <Link
      href={`/prototype/people/${person.id}`}
      className="olp-person-chip"
      data-testid={`person-chip-${person.id}`}
    >
      <Avatar person={person} size={48} />
      <span>
        <b>{person.name}</b>
        {person.restrictions.length > 0 ? (
          <span className="olp-passport">
            {person.restrictions.map((restriction) => (
              <Chip
                key={restriction.id}
                itemId={restriction.itemId}
                label={restrictionLabel(restriction)}
                bucket={restriction.bucket}
              />
            ))}
          </span>
        ) : (
          <small>No rules</small>
        )}
      </span>
    </Link>
  );
}

function AddPersonForm() {
  const { household, upsertPerson } = usePrototype();
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState<(typeof AVATAR_EMOJIS)[number]>("🧑‍🍳");
  const [color, setColor] = useState<(typeof AVATAR_COLORS)[number]>(AVATAR_COLORS[0] ?? "#e07a3d");

  function onSubmit() {
    const trimmed = name.trim();
    if (!trimmed) return;
    const idBase = slugPersonName(trimmed);
    const id = household.people.some((person) => person.id === idBase) ? newId(idBase) : idBase;
    upsertPerson({
      id,
      name: trimmed,
      emoji,
      color,
      generation: "adult",
      restrictions: [],
    });
    setName("");
  }

  return (
    <form
      className="olp-add-person"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
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
        <Avatar person={{ name: name || "?", emoji, color }} size={44} />
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
      <button type="submit" className="olp-btn olp-btn-primary" disabled={!name.trim()}>
        Add person
      </button>
    </form>
  );
}

export function HouseholdHome() {
  const { household } = usePrototype();
  const summary = summarizeHousehold(household);

  return (
    <div className="olp-stack">
      <header>
        <h1>{household.name}</h1>
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

      {household.people.length === 0 ? (
        <EmptyState title="No one yet" body="Add a name and avatar." />
      ) : (
        <div className="olp-person-row">
          {household.people.map((person) => (
            <PersonCard key={person.id} person={person} />
          ))}
        </div>
      )}

      <AddPersonForm />
    </div>
  );
}
