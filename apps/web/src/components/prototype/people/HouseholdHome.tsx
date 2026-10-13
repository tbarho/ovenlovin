"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { summarizeHousehold } from "./model";
import { usePrototype } from "./store";
import { Avatar, EmptyState } from "./ui";

export function HouseholdHome() {
  const { household } = usePrototype();
  const summary = summarizeHousehold(household);

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
        className="olp-hero-card"
        data-testid="household-summary"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="olp-hero-faces" aria-hidden="true">
          {household.people.map((person) => (
            <Avatar key={person.id} person={person} size={36} />
          ))}
        </div>
        <p className="olp-kicker">Household</p>
        <h1>{household.name}</h1>
        <p className="olp-hero-line">{summary.line}</p>
        {summary.badge ? (
          <span className="olp-badge-severe" data-testid="severe-badge">
            {summary.badge}
          </span>
        ) : null}
      </motion.section>

      <section>
        <div className="olp-section-head">
          <h2>People</h2>
          <Link href="/prototype/people/setup" className="olp-text-btn">
            Add someone
          </Link>
        </div>
        <div className="olp-person-row">
          {household.people.map((person) => {
            const counts = {
              cant: person.restrictions.filter((item) => item.bucket === "cant_have").length,
              diet: person.restrictions.filter((item) => item.bucket === "doesnt_eat").length,
              prefer: person.restrictions.filter((item) => item.bucket === "rather_not").length,
            };
            const bits = [
              counts.cant ? `${counts.cant} can\u2019t have` : null,
              counts.diet ? `${counts.diet} doesn\u2019t eat` : null,
              counts.prefer ? `${counts.prefer} rather not` : null,
            ].filter(Boolean);
            return (
              <Link
                key={person.id}
                href={`/prototype/people/${person.id}`}
                className="olp-person-chip"
                data-testid={`person-chip-${person.id}`}
              >
                <Avatar person={person} size={44} />
                <span>
                  <b>{person.name}</b>
                  <small>{bits.length > 0 ? bits.join(" · ") : "Eats everything"}</small>
                </span>
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}
