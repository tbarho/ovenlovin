import { notFound } from "next/navigation";
import { PeopleService } from "@ovenlovin/core";
import { getDatabase } from "@ovenlovin/db";
import { PersonPage } from "@/components/people/PersonPage";
import { requireKitchenContext } from "@/lib/kitchen-session";

export default async function PersonDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const context = await requireKitchenContext();

  const { id } = await params;
  const service = new PeopleService(getDatabase());
  const person = await service.getPerson(id);
  if (!person || person.householdId !== context.householdId) notFound();
  const rules = await service.getRulesForPerson(id);
  const loves = await service.getPreferencesForPerson(id, "love");
  const householdPeople = await service.listPeopleByHousehold(person.householdId, { limit: 40 });

  return <PersonPage person={person} people={householdPeople.items} rules={rules} loves={loves} />;
}
