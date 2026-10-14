/**
 * Tool: save_meal_plan
 *
 * Save a meal plan to the database
 */

import { z } from "zod";
import type { AuthContext } from "../auth/index";
import { PlanService, resolveWriteActor } from "@ovenlovin/core";
import { createDbClient } from "@ovenlovin/db";

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
  checkReportJson: z.record(z.string(), z.unknown()).describe("The latest check_meal_plan result"),
  acknowledgedWarnings: z.array(z.string()).optional(),
  status: z.enum(["draft", "approved"]).default("draft"),
});

export type SaveMealPlanInput = z.infer<typeof saveMealPlanSchema>;

export interface SaveMealPlanOutput {
  planId: string;
  status: "draft" | "approved" | "archived";
  weekStart: string;
  entriesCount: number;
  message: string;
}

async function handler(
  input: SaveMealPlanInput,
  context: AuthContext
): Promise<SaveMealPlanOutput> {
  const db = createDbClient(process.env.DATABASE_URL!);
  const planService = new PlanService(db);
  const actor = resolveWriteActor({
    userId: context.userId,
    apiKeyId: context.apiKeyId,
    apiKeyCreatedBy: context.apiKeyCreatedBy,
  });

  // Create the meal plan
  const plan = await planService.createMealPlan({
    householdId: context.householdId,
    weekStart: input.weekStart,
    status: input.status,
    latestCheckReport: input.checkReportJson,
    checkedAt: new Date().toISOString(),
    acknowledgedWarnings: input.acknowledgedWarnings ?? [],
    needsRecheck: false,
    createdBy: actor.createdBy,
    createdByApiKeyId: actor.createdByApiKeyId,
  });

  // Create entries
  for (const entry of input.entries) {
    await planService.createMealPlanEntry({
      mealPlanId: plan.id,
      date: entry.date,
      mealSlot: entry.meal,
      recipeId: entry.recipeId,
      servings: entry.servings,
      attendees: entry.attendees,
      prepAheadNotes: entry.prepAheadNotes ?? null,
    });
  }

  return {
    planId: plan.id,
    status: plan.status,
    weekStart: plan.weekStart,
    entriesCount: input.entries.length,
    message: `Meal plan saved with ${input.entries.length} entries`,
  };
}

export const saveMealPlanTool = {
  name: "save_meal_plan",
  description:
    "Save a meal plan to the database with the check report. Must include the latest check_meal_plan result.",
  inputSchema: saveMealPlanSchema,
  handler,
} as const;
