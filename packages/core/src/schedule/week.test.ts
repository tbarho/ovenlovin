import { describe, expect, it } from "vitest";
import {
  defaultWeeklySchedule,
  normalizeWeeklySchedule,
  templateToWeeklyNight,
  weeklyNightToTemplateValues,
} from "./week";

describe("defaultWeeklySchedule", () => {
  it("marks Friday as a busy night and weeknights as medium", () => {
    const week = defaultWeeklySchedule();
    expect(week).toHaveLength(7);
    expect(week[1]).toMatchObject({ day: "monday", busyLevel: "medium", cooking: true });
    expect(week[5]).toMatchObject({
      day: "friday",
      busyLevel: "high",
      cooking: false,
      constraints: ["busy_night"],
    });
  });
});

describe("normalizeWeeklySchedule", () => {
  it("fills missing days from the default week", () => {
    const week = normalizeWeeklySchedule([
      { day: "friday", busyLevel: "low", cooking: true, timeBudgetMinutes: 60 },
    ]);
    expect(week[5]).toMatchObject({
      day: "friday",
      busyLevel: "low",
      cooking: true,
      timeBudgetMinutes: 60,
    });
    expect(week[1]?.day).toBe("monday");
    expect(week[1]?.busyLevel).toBe("medium");
  });
});

describe("template mapping", () => {
  it("round-trips a busy Friday through schedule_template rows", () => {
    const friday = defaultWeeklySchedule()[5]!;
    const values = weeklyNightToTemplateValues(friday);
    const back = templateToWeeklyNight({
      ...values,
      busyLevel: values.busyLevel,
    });
    expect(back).toMatchObject({
      day: "friday",
      busyLevel: "high",
      cooking: false,
      constraints: ["busy_night"],
    });
  });
});
