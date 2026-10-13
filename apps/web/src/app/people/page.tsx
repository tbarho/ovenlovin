import Link from "next/link";
import { redirect } from "next/navigation";
import { PeopleService } from "@ovenlovin/core";
import { getDatabase } from "@ovenlovin/db";
import { AddPersonForm } from "@/components/kitchen/AddPersonForm";
import { getSessionContext } from "@/lib/session";

export default async function PeoplePage() {
  const context = await getSessionContext().catch(() => null);
  if (!context?.householdId) redirect("/sign-in");

  const people = await new PeopleService(getDatabase()).listPeopleByHousehold(context.householdId, {
    limit: 40,
  });

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
        <Link className="btn" href="/recipes">
          Back to recipes
        </Link>
      </div>
      <AddPersonForm />
      <div className="recipe-grid">
        {people.items.map((person) => (
          <Link className="recipe-card" key={person.id} href={`/people/${person.id}`}>
            <h2>{person.displayName}</h2>
            <p className="muted">View and edit dietary rules</p>
          </Link>
        ))}
      </div>
    </>
  );
}
