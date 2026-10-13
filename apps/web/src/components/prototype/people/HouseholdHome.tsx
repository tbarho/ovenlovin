"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import type { CSSProperties } from "react";
import { FoodIcon } from "./icons";
import {
  personTheme,
  restrictionLabel,
  safeToCookLine,
  severePeople,
  summarizeHousehold,
  type Person,
} from "./model";
import { usePrototype } from "./store";
import { Avatar, Chip, EmptyState } from "./ui";

function IdentityCard({ person }: { person: Person }) {
  const theme = personTheme(person.color);
  const chips = person.restrictions.slice(0, 5);
  return (
    <Link
      href={`/prototype/people/${person.id}`}
      className="olp-identity-card"
      data-testid={`person-chip-${person.id}`}
      style={
        {
          "--olp-theme": person.color,
          "--olp-theme-wash": theme.wash,
          "--olp-theme-glow": theme.glow,
        } as CSSProperties
      }
    >
      <div className="olp-identity-wash">
        <Avatar person={person} size={72} />
      </div>
      <div className="olp-identity-body">
        <span>
          <b>{person.name}</b>
          <small>{person.generation === "kid" ? "Kid" : "Adult"}</small>
        </span>
        {chips.length > 0 ? (
          <div className="olp-passport" aria-label={`${person.name}'s food passport`}>
            {chips.map((restriction) => (
              <Chip
                key={restriction.id}
                itemId={restriction.itemId}
                label={restrictionLabel(restriction)}
                bucket={restriction.bucket}
              />
            ))}
          </div>
        ) : (
          <p className="olp-passport-empty">Eats everything — for now.</p>
        )}
      </div>
    </Link>
  );
}

export function HouseholdHome() {
  const { household } = usePrototype();
  const summary = summarizeHousehold(household);
  const severe = severePeople(household);

  if (household.people.length === 0) {
    return (
      <EmptyState
        title="Who do you cook for?"
        body="Add people first — a name and a face is enough. Rules come next, one person at a time."
        action={
          <Link href="/prototype/people/setup" className="olp-btn olp-btn-primary">
            Start household setup
          </Link>
        }
      />
    );
  }

  return (
    <div className="olp-stack">
      <motion.section
        className={`olp-hero-card${summary.severeCount > 0 ? " is-severe" : ""}`}
        data-testid="household-summary"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 280, damping: 24 }}
      >
        <div className="olp-hero-faces" aria-hidden="true">
          {household.people.map((person) => (
            <Avatar key={person.id} person={person} size={40} />
          ))}
        </div>
        <div className="olp-hero-status">
          <span className="olp-hero-dot" />
          Safe to cook
        </div>
        <p className="olp-kicker">Household</p>
        <h1>{household.name}</h1>
        <p className="olp-hero-line">{safeToCookLine(summary)}</p>
        <p className="olp-hero-avoids">{summary.line}</p>
        {summary.badge ? (
          <span className="olp-badge-severe" data-testid="severe-badge">
            <FoodIcon id="peanut" size={16} />
            {summary.badge}
            {severe[0] ? ` · ${severe[0].name}` : null}
          </span>
        ) : null}
      </motion.section>

      <section>
        <div className="olp-section-head">
          <div>
            <p className="olp-kicker">Food passports</p>
            <h2>People</h2>
          </div>
          <Link href="/prototype/people/setup" className="olp-text-btn">
            Add someone
          </Link>
        </div>
        <div className="olp-person-row">
          {household.people.map((person, index) => (
            <motion.div
              key={person.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.04, type: "spring", stiffness: 320, damping: 24 }}
            >
              <IdentityCard person={person} />
            </motion.div>
          ))}
        </div>
      </section>
    </div>
  );
}
