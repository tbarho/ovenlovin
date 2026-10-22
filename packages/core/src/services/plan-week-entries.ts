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
