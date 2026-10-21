/**
 * Tool: get_meal_plan
 *
 * Get a saved meal plan by ID or date range
 */

import { z } from "zod";
import type { AuthContext } from "../auth/index";
import { PlanService, RecipeService, PeopleService } from "@ovenlovin/core";
import { createDbClient } from "@ovenlovin/db";

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
  cookFor: number | null;
  status: "draft" | "approved" | "archived";
  entries: Array<{
    date: string;
    meal: string;
    recipe: {
      id: string;
      title: string;
      prepTimeMinutes?: number;
      cookTimeMinutes?: number;
    } | null;
    freeformMeal?: string;
    servings: number | null;
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

async function handler(input: GetMealPlanInput, context: AuthContext): Promise<GetMealPlanOutput> {
  const db = createDbClient(process.env.DATABASE_URL!);
  const planService = new PlanService(db);
  const recipeService = new RecipeService(db);
  const peopleService = new PeopleService(db);

  let plan;
  if (input.planId) {
    plan = await planService.getMealPlan(input.planId);
  } else if (input.weekStart) {
    const plans = await planService.listMealPlans(context.householdId, {
      weekStart: input.weekStart,
      weekEnd: input.weekStart,
    });
    plan = plans.items[0] ?? null;
  }

  if (!plan || plan.householdId !== context.householdId) {
    throw new Error("Meal plan not found");
  }

  // Load entries
  const entries = await planService.getMealPlanEntries(plan.id);

  // Enrich entries with recipe and attendee details
  const enrichedEntries = await Promise.all(
    entries.map(async (entry) => {
      let recipe = null;
      if (entry.recipeId) {
        const recipeData = await recipeService.getRecipe(entry.recipeId);
        if (recipeData) {
          recipe = {
            id: recipeData.id,
            title: recipeData.title,
            prepTimeMinutes: recipeData.prepTimeMinutes ?? undefined,
            cookTimeMinutes: recipeData.cookTimeMinutes ?? undefined,
          };
        }
      }

      const attendeeDetails = await Promise.all(
        entry.attendees.map(async (personId) => {
          const person = await peopleService.getPerson(personId);
          return person
            ? {
                id: person.id,
                displayName: person.displayName,
              }
            : null;
        })
      );

      return {
        date: entry.date,
        meal: entry.mealSlot,
        recipe: recipe,
        freeformMeal: entry.freeformMeal ?? undefined,
        servings: entry.servings ?? null,
        attendees: attendeeDetails.filter((a): a is NonNullable<typeof a> => a !== null),
        prepAheadNotes: entry.prepAheadNotes ?? undefined,
      };
    })
  );

  // Build check report summary if available
  const latestReport = plan.latestCheckReport as
    | {
        status?: "complete" | "incomplete";
        overallSummary?: { blockingIssues?: number; warnings?: number };
      }
    | undefined;

  const checkReport = latestReport
    ? {
        status: (latestReport.status ?? "incomplete") as "complete" | "incomplete",
        blockingIssues: latestReport.overallSummary?.blockingIssues ?? 0,
        warnings: latestReport.overallSummary?.warnings ?? 0,
        checkedAt: plan.checkedAt ?? new Date().toISOString(),
      }
    : undefined;

  return {
    id: plan.id,
    weekStart: plan.weekStart,
    cookFor: plan.cookFor ?? null,
    status: plan.status,
    entries: enrichedEntries,
    checkReport,
    acknowledgedWarnings: plan.acknowledgedWarnings,
  };
}

export const getMealPlanTool = {
  name: "get_meal_plan",
  description:
    "Get a saved meal plan by ID or week start date. Freeform nights (leftovers, no-cook) return freeformMeal and servings with recipe=null.",
  inputSchema: getMealPlanSchema,
  handler,
} as const;
