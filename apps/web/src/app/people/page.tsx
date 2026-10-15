import { HouseholdService, PeopleService } from "@ovenlovin/core";
import { getDatabase } from "@ovenlovin/db";
import { PeopleHome } from "@/components/people/PeopleHome";
import { requireKitchenContext } from "@/lib/kitchen-session";

export default async function PeoplePage() {
  const context = await requireKitchenContext();

  const db = getDatabase();
  const service = new PeopleService(db);
  const household = await new HouseholdService(db).getHousehold(context.householdId);
  const people = await service.listPeopleByHousehold(context.householdId, {
    limit: 40,
  });
  const personIds = people.items.map((person) => person.id);
  const rules = await service.getRulesForPeople(personIds);
  const loves = await service.getPreferencesForPeople(personIds, "love");

  return (
    <PeopleHome
      householdName={household?.name ?? "Your kitchen"}
      people={people.items}
      rules={rules}
      loves={loves}
    />
  );
}
