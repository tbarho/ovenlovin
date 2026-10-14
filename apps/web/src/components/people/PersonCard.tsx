"use client";

import Link from "next/link";
import { useMemo, type ReactNode } from "react";
import {
  RULE_UI_BUCKETS,
  displayNameForTarget,
  loveLabel,
  uiBucketForRule,
} from "@ovenlovin/allergens";
import type { Person, PersonRule, Preference } from "@ovenlovin/core";
import { appearanceForPerson } from "@/lib/person-appearance";
import {
  budgetChips,
  sortCantEatChips,
  sortDoesntLikeChips,
  sortLoveChips,
  type PersonCardChip,
} from "./person-card-chips";
import { Avatar, Chip, type ChipBucket } from "./ui";

const CARD_LANES: Array<{ bucket: ChipBucket; label: string }> = [
  ...RULE_UI_BUCKETS,
  { bucket: "loves", label: "Loves" },
];

export function PersonCard({
  person,
  rules,
  loves,
  handle,
}: {
  person: Person;
  rules: PersonRule[];
  loves: Preference[];
  handle?: ReactNode;
}) {
  const appearance = appearanceForPerson(person);
  const grouped = useMemo(() => {
    const map: Record<ChipBucket, PersonCardChip[]> = {
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
        kind: rule.kind,
      });
    }
    map.cant_eat = sortCantEatChips(map.cant_eat);
    map.doesnt_like = sortDoesntLikeChips(map.doesnt_like);
    map.loves = sortLoveChips(map.loves);
    return map;
  }, [loves, rules]);

  return (
    <>
      <div className="olp-person-card-head">
        {handle}
        <Link
          href={`/people/${person.id}`}
          className="olp-person-identity"
          data-testid={`person-chip-${person.id}`}
        >
          <Avatar name={person.displayName} appearance={appearance} size={40} />
          <b>{person.displayName}</b>
        </Link>
      </div>
      <Link href={`/people/${person.id}`} className="olp-person-card-body">
        <span className="olp-person-card-lanes">
          {CARD_LANES.map((lane) => {
            const items = grouped[lane.bucket];
            const { shown, more } = budgetChips(items);
            return (
              <span
                key={lane.bucket}
                className={`olp-person-card-lane olp-person-card-lane-${lane.bucket}`}
                data-testid={`person-card-${lane.bucket}-${person.id}`}
              >
                <span className="olp-person-card-lane-label">
                  {lane.label}
                  <span className="olp-person-card-lane-count">{items.length}</span>
                </span>
                {items.length > 0 ? (
                  <span className="olp-passport olp-person-card-chips">
                    {shown.map((item) => (
                      <Chip
                        key={item.key}
                        target={item.target}
                        label={item.label}
                        bucket={lane.bucket}
                        animated={false}
                      />
                    ))}
                    {more > 0 ? (
                      <span
                        className="olp-person-card-more"
                        data-testid={`person-card-more-${lane.bucket}-${person.id}`}
                      >
                        +{more} more
                      </span>
                    ) : null}
                  </span>
                ) : (
                  <small>None</small>
                )}
              </span>
            );
          })}
        </span>
      </Link>
    </>
  );
}
