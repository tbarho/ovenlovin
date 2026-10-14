"use client";

import Link from "next/link";
import type { Person } from "@ovenlovin/core";
import { appearanceForPerson } from "@/lib/person-appearance";
import { Avatar } from "./ui";

export function PersonSwitcher({ people, currentId }: { people: Person[]; currentId: string }) {
  if (people.length < 2) return null;

  return (
    <nav className="olp-person-switch" aria-label="People">
      {people.map((person) => {
        const current = person.id === currentId;
        return (
          <Link
            key={person.id}
            href={`/people/${person.id}`}
            className={current ? "is-current" : undefined}
            aria-current={current ? "page" : undefined}
            data-testid={`switch-person-${person.id}`}
          >
            <Avatar name={person.displayName} appearance={appearanceForPerson(person)} size={36} />
            <span>{person.displayName}</span>
          </Link>
        );
      })}
    </nav>
  );
}
