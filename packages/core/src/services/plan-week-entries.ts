export type PlanWeekEntryLike = {
  date: string;
  mealSlot: string;
  createdAt?: string;
  updatedAt?: string;
  deletedAt?: string | null;
  recipeId?: string | null;
};

/** Same week can have leftover plans; use the one updated last. */
export function pickPlanForWeek<T extends { id: string; weekStart: string; updatedAt: string }>(
  plans: T[],
  weekStart: string
): T | null {
  const matches = plans.filter((item) => item.weekStart === weekStart);
  if (matches.length === 0) return null;
  return (
    [...matches].sort((a, b) => {
      const updated = b.updatedAt.localeCompare(a.updatedAt);
      if (updated !== 0) return updated;
      return b.id.localeCompare(a.id);
    })[0] ?? null
  );
}

/** Drop nights whose recipe was deleted so they cannot ghost the plan or list. */
export function keepLiveRecipeEntries<T extends { recipeId?: string | null }>(
  entries: T[],
  liveRecipeIds: ReadonlySet<string>
): T[] {
  return entries.filter((entry) => !entry.recipeId || liveRecipeIds.has(entry.recipeId));
}

/* eslint-disable no-unused-vars -- call-signature parameter names */
type LiveRecipeLookup = (recipeId: string) => Promise<unknown>;
/* eslint-enable no-unused-vars */

/** Plan reads: resolve live recipes, then drop deleted-recipe nights. */
export async function liveEntriesForPlanRead<T extends { recipeId?: string | null }>(
  entries: T[],
  isLiveRecipe: LiveRecipeLookup
): Promise<T[]> {
  const liveRecipeIds = new Set<string>();
  await Promise.all(
    [
      ...new Set(entries.map((entry) => entry.recipeId).filter((id): id is string => Boolean(id))),
    ].map(async (recipeId) => {
      if (await isLiveRecipe(recipeId)) liveRecipeIds.add(recipeId);
    })
  );
  return keepLiveRecipeEntries(entries, liveRecipeIds);
}

export function toIsoDateOnly(value: string): string {
  if (/^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) return value;
  return new Date(parsed).toISOString().slice(0, 10);
}

export function mondayWeekDates(weekStart: string): string[] {
  const start = toIsoDateOnly(weekStart);
  const { year, month, day } = splitIsoDate(start);
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(Date.UTC(year, month, day + index));
    return date.toISOString().slice(0, 10);
  });
}

/** Monday of the week containing `now` (UTC date). */
export function currentMondayWeekStart(now = new Date()): string {
  const iso = now.toISOString().slice(0, 10);
  const { year, month, day } = splitIsoDate(iso);
  const date = new Date(Date.UTC(year, month, day));
  const weekday = date.getUTCDay();
  const offset = weekday === 0 ? -6 : 1 - weekday;
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
}

/** One week before `currentMondayWeekStart`. Recheck from here so a US Sunday evening still flags the in-progress week. */
export function previousMondayWeekStart(now = new Date()): string {
  const monday = currentMondayWeekStart(now);
  const { year, month, day } = splitIsoDate(monday);
  return new Date(Date.UTC(year, month, day - 7)).toISOString().slice(0, 10);
}

/**
 * Keep one live entry per date+slot on the plan week.
 * Soft-deleted, out-of-week, and older duplicate slots are dropped so a
 * removed dinner cannot keep shopping for that recipe.
 */
export function planEntriesForWeek<T extends PlanWeekEntryLike>(
  entries: T[],
  weekStart: string
): T[] {
  const dates = new Set(mondayWeekDates(weekStart));
  const bySlot = new Map<string, T>();
  const ranked = [...entries]
    .filter((entry) => !entry.deletedAt)
    .sort((left, right) => recency(left).localeCompare(recency(right)));

  for (const entry of ranked) {
    const date = toIsoDateOnly(entry.date);
    if (!dates.has(date)) continue;
    bySlot.set(`${date}|${entry.mealSlot}`, { ...entry, date });
  }

  return [...bySlot.values()].sort(
    (left, right) =>
      left.date.localeCompare(right.date) || left.mealSlot.localeCompare(right.mealSlot)
  );
}

function splitIsoDate(iso: string): { year: number; month: number; day: number } {
  const [year, month, day] = iso.split("-").map((part) => Number(part));
  if (!year || !month || !day) {
    throw new Error(`Invalid ISO date: ${iso}`);
  }
  return { year, month: month - 1, day };
}

function recency(entry: PlanWeekEntryLike): string {
  return entry.updatedAt || entry.createdAt || "";
}
