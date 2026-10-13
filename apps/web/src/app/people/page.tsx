import { redirect } from "next/navigation";
import { PeopleService } from "@ovenlovin/core";
import { getDatabase } from "@ovenlovin/db";
import { AddPersonForm } from "@/components/kitchen/AddPersonForm";
import { PersonActions } from "@/components/kitchen/PersonActions";
import { PersonCard } from "@/components/kitchen/PersonCard";
import { getSessionContext } from "@/lib/session";

export default async function PeoplePage() {
  const context = await getSessionContext().catch(() => null);
  if (!context?.householdId) redirect("/sign-in");

  const service = new PeopleService(getDatabase());
  const people = await service.listPeopleByHousehold(context.householdId, {
    limit: 40,
  });
  const rules = await service.getRulesForPeople(people.items.map((person) => person.id));
  const rulesByPerson = new Map<string, typeof rules>();
  for (const rule of rules) {
    const list = rulesByPerson.get(rule.personId) ?? [];
    list.push(rule);
    rulesByPerson.set(rule.personId, list);
  }

  return (
    <>
      <div className="kitchen-head">
        <div>
          <p className="badge">
            <i />
            Household
          </p>
          <h1>People and rules</h1>
          <p className="muted">
            Rules are per person. First sign-in created this household and a person for you.
          </p>
        </div>
      </div>
      <AddPersonForm />
      {people.items.length === 0 ? (
        <p className="empty-note">No people yet. Add someone above to start writing rules.</p>
      ) : (
        <div className="person-grid">
          {people.items.map((person) => (
            <PersonCard
              key={person.id}
              person={person}
              rules={rulesByPerson.get(person.id) ?? []}
              actions={
                <PersonActions
                  person={person}
                  ruleCount={(rulesByPerson.get(person.id) ?? []).length}
                />
              }
            />
          ))}
        </div>
      )}
    </>
  );
}
