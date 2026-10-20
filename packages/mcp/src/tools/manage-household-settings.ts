import { z } from "zod";
import type { AuthContext } from "../auth/index";
import { requireWriteRole } from "../auth/index";
import {
  HouseholdService,
  PeopleService,
  type HouseholdServingsSettings,
  SERVINGS_HARD_MAX,
  updateHouseholdServingsSettingsSchema,
} from "@ovenlovin/core";
import { createDbClient } from "@ovenlovin/db";

export const manageHouseholdSettingsSchema = z.object({
  action: z.enum(["get", "update"]).default("get"),
  mode: z.enum(["family", "fixed", "recipe"]).optional(),
  servings: z.number().int().min(1).max(SERVINGS_HARD_MAX).optional().nullable(),
});

async function settingsFor(
  householdId: string,
  db = createDbClient(process.env.DATABASE_URL!)
): Promise<HouseholdServingsSettings> {
  const households = new HouseholdService(db);
  const household = await households.getHousehold(householdId);
  if (!household) throw new Error(`Household not found: ${householdId}`);
  const people = await new PeopleService(db).listPeopleByHousehold(householdId, { limit: 40 });
  return households.servingsSettingsFor(household, people.items.length);
}

async function handler(
  input: z.infer<typeof manageHouseholdSettingsSchema>,
  context: AuthContext
): Promise<HouseholdServingsSettings> {
  const db = createDbClient(process.env.DATABASE_URL!);
  if (input.action === "update") {
    requireWriteRole(context);
    if (!input.mode) throw new Error("mode is required to update Default servings");
    const parsed = updateHouseholdServingsSettingsSchema.parse({
      mode: input.mode,
      servings: input.servings,
    });
    await new HouseholdService(db).updateServingsSettings(context.householdId, parsed);
  }

  return settingsFor(context.householdId, db);
}

export const manageHouseholdSettingsTool = {
  name: "manage_household_settings",
  description:
    "Get or update kitchen Default servings: match the family size, a fixed number (1-99), or the recipe card's stored servings. Family size is the People (dietary profiles) count, not signed-in kitchen members.",
  inputSchema: manageHouseholdSettingsSchema,
  handler,
} as const;
