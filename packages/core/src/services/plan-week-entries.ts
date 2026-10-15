export type PlanWeekEntryLike = {
  date: string;
  mealSlot: string;
  createdAt?: string;
  updatedAt?: string;
  deletedAt?: string | null;
};

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
