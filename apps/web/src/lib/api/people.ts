import { NotFoundError } from "@/lib/api/errors";

export function assertPersonHousehold(
  person: { householdId: string } | null,
  householdId: string,
  id?: string
): asserts person is { householdId: string } {
  if (!person || person.householdId !== householdId) {
    throw new NotFoundError("Person", id);
  }
}
