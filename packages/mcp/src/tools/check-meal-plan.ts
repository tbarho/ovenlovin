/**
 * Tool: check_meal_plan
 *
 * Check a meal plan against household rules and schedule constraints
 */

import { z } from "zod";
import type { AuthContext } from "../auth/index.js";

export const checkMealPlanSchema = z.object({
  plan: z.object({
    weekStart: z.string().date(),
    entries: z.array(
      z.object({
        date: z.string().date(),
        meal: z.string(),
        recipeId: z.string().uuid(),
        servings: z.number().int().positive(),
        attendees: z.array(z.string()),
      })
    ),
  }),
});

export type CheckMealPlanInput = z.infer<typeof checkMealPlanSchema>;

export interface CheckMealPlanOutput {
  status: "complete" | "incomplete";
  overallSummary: {
    totalEntries: number;
    blockingIssues: number;
    warnings: number;
    preferAvoidances: number;
  };
  entries: Array<{
    date: string;
    meal: string;
    recipeTitle: string;
    findings: Array<{
      personId: string;
      personName: string;
      ruleId: string;
      severity: "block" | "warn" | "prefer_avoid";
      message: string;
      evidence: {
        ingredient: string;
        matchType: "contains" | "may_contain" | "cross_contact" | "derived_from";
        confidence: number;
      };
    }>;
    scheduleIssues?: Array<{
      type: "time_budget" | "method_mismatch" | "attendance";
      message: string;
    }>;
  }>;
  nutritionSummary?: {
    coverage: string;
    notes: string[];
  };
  incompleteReason?: string;
}

async function handler(
  _input: CheckMealPlanInput,
  _context: AuthContext
): Promise<CheckMealPlanOutput> {
  // TODO: Implement using @ovenlovin/allergens (when merged)
  // - Load recipes
  // - Load attendee rules
  // - Check each entry against rules
  // - Check schedule constraints
  // - Return deterministic findings

  throw new Error(
    "Not implemented: check_meal_plan - depends on @ovenlovin/allergens rules engine"
  );
}

export const checkMealPlanTool = {
  name: "check_meal_plan",
  description:
    "Check a meal plan against per-person rules and schedule constraints. Returns per-entry, per-person findings by severity. MUST be called before saving a plan.",
  inputSchema: checkMealPlanSchema,
  handler,
} as const;
