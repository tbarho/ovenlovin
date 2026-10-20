import { z } from "zod";
import type { AuthContext } from "../auth/index";
import { requireWriteRole } from "../auth/index";
import { ScheduleService, type HouseholdScheduleView } from "@ovenlovin/core";
import { createDbClient } from "@ovenlovin/db";

const nightSchema = z.object({
  dayOfWeek: z.number().int().min(0).max(6).optional(),
  day: z.string().optional(),
  busyLevel: z.enum(["low", "medium", "high"]).optional(),
  timeBudgetMinutes: z.number().int().positive().optional(),
  cooking: z.boolean().optional(),
  attendees: z.array(z.string()).optional(),
  constraints: z.array(z.string()).optional(),
});

export const manageHouseholdScheduleSchema = z.object({
  action: z.enum(["get", "replace"]).default("get"),
  week: z.array(nightSchema).optional(),
});

async function handler(
  input: z.infer<typeof manageHouseholdScheduleSchema>,
  context: AuthContext
): Promise<HouseholdScheduleView> {
  const db = createDbClient(process.env.DATABASE_URL!);
  const schedules = new ScheduleService(db);
  const actor = context.userId ?? context.apiKeyId ?? context.householdId;

  if (input.action === "replace") {
    requireWriteRole(context);
    if (!input.week) throw new Error("week is required to replace the household schedule");
    return schedules.replaceSchedule(context.householdId, input.week, actor);
  }

  return schedules.getSchedule(context.householdId);
}

export const manageHouseholdScheduleTool = {
  name: "manage_household_schedule",
  description:
    "Get or replace the household weekly availability and busy-night schedule (dinner time budget per weekday).",
  inputSchema: manageHouseholdScheduleSchema,
  handler,
} as const;
