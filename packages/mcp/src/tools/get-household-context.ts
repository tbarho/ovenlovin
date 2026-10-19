/**
 * Tool: get_household_context
 *
 * Get household schedule, people, rules, preferences, and recent meal history
 */

import { z } from "zod";
import type { AuthContext } from "../auth/index";
import {
  HouseholdService,
  PeopleService,
  ScheduleService,
  type HouseholdServingsSettings,
} from "@ovenlovin/core";
import { createDbClient } from "@ovenlovin/db";
import { LOVE_PREFERENCE_TYPE, loveLabel } from "@ovenlovin/allergens";

export const getHouseholdContextSchema = z.object({
  includeSchedule: z.boolean().default(true),
  includePeople: z.boolean().default(true),
  includePreferences: z.boolean().default(true),
  includeRecentMeals: z.boolean().default(true),
});

export type GetHouseholdContextInput = z.infer<typeof getHouseholdContextSchema>;

export interface GetHouseholdContextOutput {
  household: {
    id: string;
    name: string;
    servingsSettings: HouseholdServingsSettings;
  };
  schedule?: {
    weeklyTemplate: Array<{
      day: string;
      meal: string;
      busyLevel: "low" | "medium" | "high";
      timeBudgetMinutes?: number;
      cooking: boolean;
      attendees: string[];
      constraints: string[];
    }>;
    overrides: Array<{
      date: string;
      meal: string;
      note: string;
    }>;
  };
  people?: Array<{
    id: string;
    displayName: string;
    sortOrder: number;
    age?: number;
    activityProfile?: string;
    rulesSummary: {
      blockCount: number;
      warnCount: number;
      preferAvoidCount: number;
    };
    loves: Array<{ value: string; label: string }>;
    labelNotes?: string[];
  }>;
  preferences?: {
    cuisines: string[];
    avoidances: string[];
    loves: Array<{ personId: string; personName: string; value: string; label: string }>;
  };
  recentMeals?: Array<{
    date: string;
    meal: string;
    recipeTitle: string;
  }>;
}

async function handler(
  input: GetHouseholdContextInput,
  context: AuthContext
): Promise<GetHouseholdContextOutput> {
  const db = createDbClient(process.env.DATABASE_URL!);
  const householdService = new HouseholdService(db);
  const peopleService = new PeopleService(db);
  const scheduleService = new ScheduleService(db);

  // Fetch household details
  const household = await householdService.getHousehold(context.householdId);
  if (!household) {
    throw new Error(`Household not found: ${context.householdId}`);
  }

  const peopleResult = await peopleService.listPeopleByHousehold(context.householdId);
  const servingsSettings = householdService.servingsSettingsFor(
    household,
    peopleResult.items.length
  );

  const result: GetHouseholdContextOutput = {
    household: {
      id: household.id,
      name: household.name,
      servingsSettings,
    },
  };

  // Get people with rule summaries if requested
  if (input.includePeople) {
    const peopleWithRules = await Promise.all(
      peopleResult.items.map(async (person) => {
        const rules = await peopleService.getRulesForPerson(person.id);
        const loves = await peopleService.getPreferencesForPerson(person.id, LOVE_PREFERENCE_TYPE);

        // Count rules by severity
        const rulesSummary = {
          blockCount: rules.filter((r) => r.severity === "block").length,
          warnCount: rules.filter((r) => r.severity === "warn").length,
          preferAvoidCount: rules.filter((r) => r.severity === "prefer_avoid").length,
        };

        // Calculate age if birth year is available
        const age = person.birthYear ? new Date().getFullYear() - person.birthYear : undefined;

        // Collect label notes from rules
        const labelNotes = rules.filter((r) => r.label).map((r) => r.label!);

        return {
          id: person.id,
          displayName: person.displayName,
          sortOrder: person.sortOrder,
          age,
          activityProfile: person.activityProfile ?? undefined,
          rulesSummary,
          loves: loves.map((item) => ({
            value: item.value,
            label: loveLabel(item.value),
          })),
          labelNotes: labelNotes.length > 0 ? labelNotes : undefined,
        };
      })
    );

    result.people = peopleWithRules;

    if (input.includePreferences) {
      result.preferences = {
        cuisines: peopleWithRules.flatMap((person) =>
          person.loves
            .filter((love) => /mexican|italian|chinese|american/i.test(love.value))
            .map((love) => love.label)
        ),
        avoidances: [],
        loves: peopleWithRules.flatMap((person) =>
          person.loves.map((love) => ({
            personId: person.id,
            personName: person.displayName,
            value: love.value,
            label: love.label,
          }))
        ),
      };
    }
  }

  if (input.includeSchedule) {
    const schedule = await scheduleService.getSchedule(context.householdId);
    result.schedule = {
      weeklyTemplate: schedule.weeklyTemplate.map((night) => ({
        day: night.day,
        meal: night.meal,
        busyLevel: night.busyLevel,
        timeBudgetMinutes: night.timeBudgetMinutes,
        cooking: night.cooking,
        attendees: night.attendees,
        constraints: night.constraints,
      })),
      overrides: schedule.overrides,
    };
  }

  if (input.includeRecentMeals) {
    result.recentMeals = await scheduleService.listRecentMeals(context.householdId);
  }

  return result;
}

export const getHouseholdContextTool = {
  name: "get_household_context",
  description:
    "Get household context including Default servings (family size, mode, cook-for), schedule, attendees, rule summaries, preferences, and recent meal history. Essential for meal planning. Not medical advice - always check ingredient labels before serving.",
  inputSchema: getHouseholdContextSchema,
  handler,
} as const;
