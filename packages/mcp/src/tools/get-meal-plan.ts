/**
 * Tool: get_meal_plan
 *
 * Get a saved meal plan by ID or date range
 */

import { z } from "zod";
import type { AuthContext } from "../auth/index";

export const getMealPlanSchema = z
  .object({
    planId: z.string().uuid().optional(),
    weekStart: z.string().date().optional(),
  })
  .refine((data) => data.planId || data.weekStart, {
    message: "Must provide either planId or weekStart",
  });

export type GetMealPlanInput = z.infer<typeof getMealPlanSchema>;

export interface GetMealPlanOutput {
  id: string;
  weekStart: string;
  status: "draft" | "approved" | "archived";
  entries: Array<{
    date: string;
    meal: string;
    recipe: {
      id: string;
      title: string;
      prepTimeMinutes?: number;
      cookTimeMinutes?: number;
    };
    servings: number;
    attendees: Array<{
      id: string;
      displayName: string;
    }>;
    prepAheadNotes?: string;
  }>;
  checkReport?: {
    status: "complete" | "incomplete";
    blockingIssues: number;
    warnings: number;
    checkedAt: string;
  };
  acknowledgedWarnings: string[];
}

async function handler(
  _input: GetMealPlanInput,
  _context: AuthContext
): Promise<GetMealPlanOutput> {
  // TODO: Implement using @ovenlovin/core service
  // - Fetch plan by ID or weekStart
  // - Return plan with entries and check report

  throw new Error("Not implemented: get_meal_plan");
}

export const getMealPlanTool = {
  name: "get_meal_plan",
  description: "Get a saved meal plan by ID or week start date.",
  inputSchema: getMealPlanSchema,
  handler,
} as const;
