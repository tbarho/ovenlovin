import type { ReactNode } from "react";
import Link from "next/link";
import type { Person, PersonRule } from "@ovenlovin/core";
import { describeRuleChip } from "@ovenlovin/allergens";
import { RuleChip } from "./RuleChip";

export function PersonCard({
  person,
  rules,
  actions,
}: {
  person: Person;
  rules: PersonRule[];
  actions?: ReactNode;
}) {
  return (
    <article className="person-card">
      <header className="person-card-head">
        <Link href={`/people/${person.id}`} className="person-card-title">
          <h2>{person.displayName}</h2>
        </Link>
        {actions ? <div className="person-card-actions">{actions}</div> : null}
      </header>
      {rules.length === 0 ? (
        <p className="muted person-card-empty">No rules yet</p>
      ) : (
        <ul className="rule-chips">
          {rules.map((rule) => {
            const chip = describeRuleChip(rule);
            return (
              <li key={rule.id}>
                <RuleChip text={chip.text} severity={chip.severity} />
              </li>
            );
          })}
        </ul>
      )}
      <Link className="person-card-open" href={`/people/${person.id}`}>
        View rules
      </Link>
    </article>
  );
}
