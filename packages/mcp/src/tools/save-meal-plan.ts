/**
 * Tool: save_meal_plan
 *
 * Save a meal plan to the database
 */

import { z } from "zod";
import type { AuthContext } from "../auth/index";
import { requireWriteRole } from "../auth/index";
import {
  agreedEntryCookFor,
  PlanService,
  resolveWriteActor,
  SERVINGS_HARD_MAX,
} from "@ovenlovin/core";
import { createDbClient } from "@ovenlovin/db";

export const saveMealPlanSchema = z.object({
  weekStart: z.string().date(),
  cookFor: z
    .number()
    .int()
    .min(1)
    .max(SERVINGS_HARD_MAX)
    .optional()
    .describe("Week cook-for. Night labels and the shopping list all use this one count."),
  entries: z.array(
    z.object({
      date: z.string().date(),
      meal: z.string(),
      recipeId: z.string().uuid().optional(),
      freeformMeal: z
        .string()
        .min(1)
        .max(255)
        .optional()
        .describe("Leftovers, eat-out, or an empty night with no recipe"),
      servings: z.number().int().positive().optional(),
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
  requireWriteRole(context);
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
    cookFor: input.cookFor ?? agreedEntryCookFor(input.entries.map((entry) => entry.servings)),
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
      recipeId: entry.recipeId ?? null,
      freeformMeal: entry.freeformMeal ?? null,
      servings: entry.servings ?? null,
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
    "Save a meal plan to the database with the check report. Nights may omit recipeId (leftovers, eat-out, empty). Must include the latest check_meal_plan result.",
  inputSchema: saveMealPlanSchema,
  handler,
} as const;
