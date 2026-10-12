/**
 * Tool: save_meal_plan
 * 
 * Save a meal plan to the database
 */

import { z } from "zod";
import type { AuthContext } from "../auth/index.js";

export const saveMealPlanSchema = z.object({
  weekStart: z.string().date(),
  entries: z.array(
    z.object({
      date: z.string().date(),
      meal: z.string(),
      recipeId: z.string().uuid(),
      servings: z.number().int().positive(),
      attendees: z.array(z.string()),
      prepAheadNotes: z.string().optional(),
    })
  ),
  checkReportJson: z.record(z.unknown()).describe("The latest check_meal_plan result"),
  acknowledgedWarnings: z.array(z.string()).optional(),
  status: z.enum(["draft", "approved"]).default("draft"),
});

export type SaveMealPlanInput = z.infer<typeof saveMealPlanSchema>;

export interface SaveMealPlanOutput {
  planId: string;
  status: "draft" | "approved";
  weekStart: string;
  entriesCount: number;
  message: string;
}

async function handler(
  _input: SaveMealPlanInput,
  _context: AuthContext
): Promise<SaveMealPlanOutput> {
  // TODO: Implement using @ovenlovin/core service
  // - Validate plan entries
  // - Store plan with check report
  // - Return plan ID
  
  throw new Error("Not implemented: save_meal_plan");
}

export const saveMealPlanTool = {
  name: "save_meal_plan",
  description: "Save a meal plan to the database with the check report. Must include the latest check_meal_plan result.",
  inputSchema: saveMealPlanSchema,
  handler,
} as const;
