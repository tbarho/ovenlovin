import { notFound } from "next/navigation";
import { AppChrome } from "@/components/kitchen/AppChrome";
import { WhoCanEat } from "@/components/kitchen/WhoCanEat";
import { PeopleHome } from "@/components/people/PeopleHome";
import { PersonPage } from "@/components/people/PersonPage";
import { isDevPreviewAllowed } from "@/lib/dev-routes";
import { writePersonNotes } from "@/lib/person-appearance";
import { testPerson, testPersonRule, testPreference } from "@/test/fixtures";
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
const parentC = testPerson({
  id: "00000000-0000-4000-8000-000000000017",
  displayName: "Parent C",
  sortOrder: 2,
  notes: writePersonNotes({ emoji: "👩", color: "#db5a9a" }),
});
const childD = testPerson({
  id: "00000000-0000-4000-8000-000000000018",
  displayName: "Child D",
  sortOrder: 3,
  notes: writePersonNotes({ emoji: "🌻", color: "#c46a1b" }),
});

const denseCantEat = ["sesame", "mustard", "celery", "lupin", "eggplant", "raisins"].map(
  (target, index) =>
    testPersonRule({
      id: `00000000-0000-4000-8000-00000000005${index}`,
      personId: parent.id,
      target,
      kind: "ingredient",
      sharedFacility: "ignore",
      includeMayContain: false,
      includeCrossContact: false,
    })
);
const denseDoesntLike = ["cilantro", "olives", "mushrooms", "onions", "garlic", "spicy"].map(
  (target, index) =>
    testPersonRule({
      id: `00000000-0000-4000-8000-00000000006${index}`,
      personId: parent.id,
      target,
      kind: "ingredient",
      severity: "prefer_avoid",
    })
);

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
  ...denseCantEat,
  ...denseDoesntLike,
];

const loves = [
  testPreference({
    personId: child.id,
    value: "salmon",
  }),
  ...["mexican", "spicy", "italian", "chicken", "pasta", "chocolate"].map((value, index) =>
    testPreference({
      id: `00000000-0000-4000-8000-00000000007${index}`,
      personId: parent.id,
      value,
    })
  ),
];

export default async function PeoplePreviewPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  if (!isDevPreviewAllowed()) notFound();
  const { view } = await searchParams;
  return (
    <AppChrome>
      {view === "person" ? (
        <div data-testid="preview-person">
          <PersonPage
            person={child}
            people={[parent, child]}
            rules={rules.filter((rule) => rule.personId === child.id)}
            loves={loves.filter((item) => item.personId === child.id)}
          />
        </div>
      ) : view === "recipe" ? (
        <div data-testid="preview-recipe" className="kitchen">
          <h1>Basil pesto pasta</h1>
          <WhoCanEat
            people={[parent, child]}
            rules={rules}
            ingredients={[
              { id: "pesto", name: "1/3 cup pesto" },
              { id: "basil", name: "basil" },
              { id: "parmesan", name: "1/2 cup Parmesan" },
            ]}
          />
        </div>
      ) : (
        <div data-testid="preview-list">
          <PeopleHome
            householdName="Household 1"
            people={[parent, child, parentC, childD]}
            rules={rules}
            loves={loves}
          />
        </div>
      )}
    </AppChrome>
  );
}
