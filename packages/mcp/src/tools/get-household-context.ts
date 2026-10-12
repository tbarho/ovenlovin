/**
 * Tool: get_household_context
 *
 * Get household schedule, people, rules, preferences, and recent meal history
 */

import { z } from "zod";
import type { AuthContext } from "../auth/index.js";

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
  };
  schedule?: {
    weeklyTemplate: Array<{
      day: string;
      meal: string;
      busyLevel: "low" | "medium" | "high";
      timeBudgetMinutes?: number;
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
    age?: number;
    activityProfile?: string;
    rulesSummary: {
      blockCount: number;
      warnCount: number;
      preferAvoidCount: number;
    };
    labelNotes?: string[];
  }>;
  preferences?: {
    cuisines: string[];
    avoidances: string[];
  };
  recentMeals?: Array<{
    date: string;
    meal: string;
    recipeTitle: string;
  }>;
}

async function handler(
  _input: GetHouseholdContextInput,
  _context: AuthContext
): Promise<GetHouseholdContextOutput> {
  // TODO: Implement using @ovenlovin/core service
  // - Fetch household details
  // - Get schedule template and overrides
  // - Get people with rule summaries (not full rules)
  // - Get recent meal history

  return {
    household: {
      id: _context.householdId,
      name: "Stub Household",
    },
  };
}

export const getHouseholdContextTool = {
  name: "get_household_context",
  description:
    "Get household context including schedule, attendees, rule summaries, preferences, and recent meal history. Essential for meal planning.",
  inputSchema: getHouseholdContextSchema,
  handler,
} as const;
