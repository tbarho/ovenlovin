import { NotFoundError, requireResourceId } from "@/lib/api/errors";

/** Path/tool ids that are malformed or belong to another kitchen are not found. */
export async function loadOwned<T extends { householdId: string }>(
  resource: string,
  id: string,
  householdId: string,
  load: (id: string) => Promise<T | null>
): Promise<T> {
  requireResourceId(resource, id);
  const row = await load(id);
  if (!row || row.householdId !== householdId) {
    throw new NotFoundError(resource, id);
  }
  return row;
}

export async function loadOwnedChild<T>(
  resource: string,
  id: string,
  load: (id: string) => Promise<T | null>,
  owned: (row: T) => boolean
): Promise<T> {
  requireResourceId(resource, id);
  const row = await load(id);
  if (!row || !owned(row)) {
    throw new NotFoundError(resource, id);
  }
  return row;
}
