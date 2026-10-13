import { AppChrome } from "@/components/kitchen/AppChrome";
import { PeopleHome } from "@/components/people/PeopleHome";
import { PersonPage } from "@/components/people/PersonPage";
import { writePersonNotes } from "@/lib/person-appearance";
import { testPerson, testPersonRule } from "@/test/fixtures";
import "@/app/prototype/people/prototype.css";
import "@/components/people/people.css";

const child = testPerson({
  id: "00000000-0000-4000-8000-000000000012",
  displayName: "Child B",
  notes: writePersonNotes({ emoji: "⚽️", color: "#2f9e62" }, "age 9, soccer"),
});
const parent = testPerson({
  displayName: "Parent A",
  notes: writePersonNotes({ emoji: "🧑‍🍳", color: "#e07a3d" }),
});

const rules = [
  testPersonRule({
    personId: child.id,
    target: "peanut",
    sharedFacility: "block",
    includeMayContain: true,
    includeCrossContact: true,
  }),
  testPersonRule({
    id: "00000000-0000-4000-8000-000000000013",
    personId: child.id,
    target: "tree_nut",
    sharedFacility: "block",
    includeMayContain: true,
    includeCrossContact: true,
    treatCoconutAsTreeNut: false,
  }),
  testPersonRule({
    id: "00000000-0000-4000-8000-000000000014",
    personId: parent.id,
    target: "dairy_free",
    kind: "diet",
    severity: "block",
    sharedFacility: "ignore",
    includeMayContain: false,
    includeCrossContact: false,
  }),
];

export default async function PeoplePreviewPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const { view } = await searchParams;
  return (
    <AppChrome>
      {view === "person" ? (
        <div data-testid="preview-person">
          <PersonPage person={child} rules={rules.filter((rule) => rule.personId === child.id)} />
        </div>
      ) : (
        <div data-testid="preview-list">
          <PeopleHome householdName="Household 1" people={[parent, child]} rules={rules} />
        </div>
      )}
    </AppChrome>
  );
}
