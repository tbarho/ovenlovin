import { PersonProfile } from "@/components/prototype/people/PersonProfile";

export default async function PrototypePersonPage({
  params,
}: {
  params: Promise<{ personId: string }>;
}) {
  const { personId } = await params;
  return <PersonProfile personId={personId} />;
}
