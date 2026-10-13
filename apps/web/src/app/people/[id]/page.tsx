import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { describeRuleChip, describeSharedFacility } from "@ovenlovin/allergens";
import { PeopleService } from "@ovenlovin/core";
import { getDatabase } from "@ovenlovin/db";
import { AddRuleForm } from "@/components/kitchen/AddRuleForm";
import { RuleChip } from "@/components/kitchen/RuleChip";
import { getSessionContext } from "@/lib/session";

export default async function PersonPage({ params }: { params: Promise<{ id: string }> }) {
  const context = await getSessionContext().catch(() => null);
  if (!context) redirect("/sign-in");

  const { id } = await params;
  const service = new PeopleService(getDatabase());
  const person = await service.getPerson(id);
  if (!person) notFound();
  const rules = await service.getRulesForPerson(id);

  return (
    <>
      <div className="kitchen-head">
        <div>
          <Link href="/people" className="muted">
            ← People
          </Link>
          <h1>{person.displayName}</h1>
          <p className="muted">Every warning names this person, the rule, and the ingredient.</p>
        </div>
      </div>
      <AddRuleForm personId={id} />
      <div className="rule-list">
        {rules.length === 0 ? (
          <p className="empty-note">No rules yet. Add a block or warn rule above.</p>
        ) : (
          rules.map((rule) => {
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
                </div>
                {rule.note ? <span className="muted">{rule.note}</span> : null}
              </div>
            );
          })
        )}
      </div>
    </>
  );
}
