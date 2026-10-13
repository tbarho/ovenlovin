import { notFound, redirect } from "next/navigation";
import { PeopleService } from "@ovenlovin/core";
import { getDatabase } from "@ovenlovin/db";
import { PersonDetail } from "@/components/kitchen/PersonDetail";
import { getSessionContext } from "@/lib/session";

export default async function PersonPage({ params }: { params: Promise<{ id: string }> }) {
  const context = await getSessionContext().catch(() => null);
  if (!context) redirect("/sign-in");

  const { id } = await params;
  const service = new PeopleService(getDatabase());
  const person = await service.getPerson(id);
  if (!person) notFound();
  const rules = await service.getRulesForPerson(id);

  return <PersonDetail person={person} rules={rules} />;
}
