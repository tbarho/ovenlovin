import { notFound, redirect } from "next/navigation";
import { PeopleService } from "@ovenlovin/core";
import { getDatabase } from "@ovenlovin/db";
import { PersonPage } from "@/components/people/PersonPage";
import { getSessionContext } from "@/lib/session";

export default async function PersonDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const context = await getSessionContext().catch(() => null);
  if (!context) redirect("/sign-in");

  const { id } = await params;
  const service = new PeopleService(getDatabase());
  const person = await service.getPerson(id);
  if (!person) notFound();
  const rules = await service.getRulesForPerson(id);
  const loves = await service.getPreferencesForPerson(id, "love");

  return <PersonPage person={person} rules={rules} loves={loves} />;
}
