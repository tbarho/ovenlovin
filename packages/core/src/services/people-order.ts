export class PeopleOrderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PeopleOrderError";
  }
}

export function orderedPersonIds(currentIds: string[], requestedIds: string[]): string[] {
  if (requestedIds.length !== currentIds.length) {
    throw new PeopleOrderError(
      "personIds must list every person in the household exactly once. Fetch GET /api/v1/people, then send the new order."
    );
  }
  const unique = new Set(requestedIds);
  if (unique.size !== requestedIds.length) {
    throw new PeopleOrderError("personIds must not contain duplicates.");
  }
  const current = new Set(currentIds);
  for (const id of requestedIds) {
    if (!current.has(id)) {
      throw new PeopleOrderError(
        `Unknown person id ${id}. Use GET /api/v1/people for the household set.`
      );
    }
  }
  return requestedIds;
}

export function movePersonId(ids: string[], id: string, delta: number): string[] {
  const index = ids.indexOf(id);
  if (index < 0) return ids;
  const next = index + delta;
  if (next < 0 || next >= ids.length) return ids;
  const copy = [...ids];
  const [item] = copy.splice(index, 1);
  if (!item) return ids;
  copy.splice(next, 0, item);
  return copy;
}

export function comparePeopleOrder(
  a: { sortOrder: number; createdAt: string; id: string },
  b: { sortOrder: number; createdAt: string; id: string }
): number {
  if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
  const created = a.createdAt.localeCompare(b.createdAt);
  if (created !== 0) return created;
  return a.id.localeCompare(b.id);
}
