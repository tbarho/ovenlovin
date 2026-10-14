export const WEEKDAY_NAMES = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
] as const;

export type WeekdayName = (typeof WEEKDAY_NAMES)[number];
export type BusyLevel = "low" | "medium" | "high";

export type WeeklyNight = {
  dayOfWeek: number;
  day: WeekdayName;
  meal: "dinner";
  busyLevel: BusyLevel;
  timeBudgetMinutes: number;
  cooking: boolean;
  attendees: string[];
  constraints: string[];
};

export type ScheduleOverrideView = {
  date: string;
  meal: string;
  note: string;
};

export type HouseholdScheduleView = {
  weeklyTemplate: WeeklyNight[];
  overrides: ScheduleOverrideView[];
};

export type RecentMeal = {
  date: string;
  meal: string;
  recipeTitle: string;
};

const DEFAULT_NIGHTS: Array<Pick<WeeklyNight, "busyLevel" | "timeBudgetMinutes" | "cooking">> = [
  { busyLevel: "low", timeBudgetMinutes: 90, cooking: true },
  { busyLevel: "medium", timeBudgetMinutes: 40, cooking: true },
  { busyLevel: "medium", timeBudgetMinutes: 40, cooking: true },
  { busyLevel: "medium", timeBudgetMinutes: 40, cooking: true },
  { busyLevel: "medium", timeBudgetMinutes: 40, cooking: true },
  { busyLevel: "high", timeBudgetMinutes: 25, cooking: false },
  { busyLevel: "low", timeBudgetMinutes: 75, cooking: true },
];

export function weekdayName(dayOfWeek: number): WeekdayName {
  return WEEKDAY_NAMES[dayOfWeek] ?? "sunday";
}

export function defaultWeeklySchedule(): WeeklyNight[] {
  return WEEKDAY_NAMES.map((day, dayOfWeek) => {
    const preset = DEFAULT_NIGHTS[dayOfWeek] ?? DEFAULT_NIGHTS[0]!;
    return {
      dayOfWeek,
      day,
      meal: "dinner",
      busyLevel: preset.busyLevel,
      timeBudgetMinutes: preset.timeBudgetMinutes,
      cooking: preset.cooking,
      attendees: [],
      constraints: preset.cooking ? [] : ["busy_night"],
    };
  });
}

function asBusyLevel(value: unknown): BusyLevel | undefined {
  return value === "low" || value === "medium" || value === "high" ? value : undefined;
}

function asDayOfWeek(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 6) {
    return value;
  }
  if (typeof value === "string") {
    const index = WEEKDAY_NAMES.indexOf(value.toLowerCase() as WeekdayName);
    if (index >= 0) return index;
    const n = Number(value);
    if (Number.isInteger(n) && n >= 0 && n <= 6) return n;
  }
  return undefined;
}

export function normalizeWeeklySchedule(input: unknown): WeeklyNight[] {
  const defaults = defaultWeeklySchedule();
  const rows = Array.isArray(input) ? input : [];
  const byDay = new Map<number, WeeklyNight>();

  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const item = row as Record<string, unknown>;
    const dayOfWeek = asDayOfWeek(item.dayOfWeek ?? item.day);
    if (dayOfWeek == null) continue;
    const fallback = defaults[dayOfWeek] ?? defaults[0]!;
    const busyLevel = asBusyLevel(item.busyLevel) ?? fallback.busyLevel;
    const cooking =
      typeof item.cooking === "boolean" ? item.cooking : busyLevel === "high" ? false : true;
    const timeBudgetMinutes =
      typeof item.timeBudgetMinutes === "number" && item.timeBudgetMinutes > 0
        ? Math.round(item.timeBudgetMinutes)
        : fallback.timeBudgetMinutes;
    const attendees = Array.isArray(item.attendees)
      ? item.attendees.filter((id): id is string => typeof id === "string")
      : [];
    const constraints = Array.isArray(item.constraints)
      ? item.constraints.filter((value): value is string => typeof value === "string")
      : cooking
        ? []
        : ["busy_night"];

    byDay.set(dayOfWeek, {
      dayOfWeek,
      day: weekdayName(dayOfWeek),
      meal: "dinner",
      busyLevel,
      timeBudgetMinutes,
      cooking,
      attendees,
      constraints: cooking
        ? constraints.filter((value) => value !== "busy_night")
        : constraints.includes("busy_night")
          ? constraints
          : [...constraints, "busy_night"],
    });
  }

  return defaults.map((night) => byDay.get(night.dayOfWeek) ?? night);
}

export function templateToWeeklyNight(row: {
  dayOfWeek: number;
  mealSlot: string;
  busyLevel: string | null;
  timeBudgetMinutes: number | null;
  attendees: string[] | null;
  constraints: Array<{ type: string; value?: string | number | boolean }> | null;
}): WeeklyNight | null {
  if (row.mealSlot !== "dinner") return null;
  const dayOfWeek = row.dayOfWeek;
  if (dayOfWeek < 0 || dayOfWeek > 6) return null;
  const fallback = defaultWeeklySchedule()[dayOfWeek] ?? defaultWeeklySchedule()[0]!;
  const constraintValues = (row.constraints ?? []).map((item) =>
    item.value != null ? `${item.type}:${String(item.value)}` : item.type
  );
  const cooking = !constraintValues.includes("busy_night");
  return {
    dayOfWeek,
    day: weekdayName(dayOfWeek),
    meal: "dinner",
    busyLevel: asBusyLevel(row.busyLevel) ?? fallback.busyLevel,
    timeBudgetMinutes: row.timeBudgetMinutes ?? fallback.timeBudgetMinutes,
    cooking,
    attendees: row.attendees ?? [],
    constraints: constraintValues,
  };
}

export function weeklyNightToTemplateValues(night: WeeklyNight): {
  name: string;
  dayOfWeek: number;
  mealSlot: string;
  busyLevel: BusyLevel;
  timeBudgetMinutes: number;
  attendees: string[];
  constraints: Array<{ type: string }>;
} {
  return {
    name: `${night.day} dinner`,
    dayOfWeek: night.dayOfWeek,
    mealSlot: "dinner",
    busyLevel: night.busyLevel,
    timeBudgetMinutes: night.timeBudgetMinutes,
    attendees: night.attendees,
    constraints: night.constraints.map((type) => ({ type })),
  };
}
