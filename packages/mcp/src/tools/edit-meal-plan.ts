/**
 * Tool: edit_meal_plan
 *
 * Set, swap, or clear a single night, or undo the last entries edit.
 */

import { z } from "zod";
import type { AuthContext } from "../auth/index";
import { requireWriteRole } from "../auth/index";
import { PlanService, RecipeService } from "@ovenlovin/core";
import { createDbClient } from "@ovenlovin/db";

export const editMealPlanSchema = z
  .object({
    planId: z.string().uuid().optional(),
    weekStart: z.string().date().optional(),
    date: z
      .string()
      .date()
      .optional()
      .describe("Night to change (YYYY-MM-DD). Required unless action is undo."),
    meal: z.string().default("dinner"),
    action: z
      .enum(["set", "swap", "clear", "undo"])
      .describe("set/swap a recipe or freeform label, clear that night, or undo the last edit."),
    recipeId: z.string().uuid().optional(),
    freeformMeal: z
      .string()
      .min(1)
      .max(255)
      .optional()
      .describe("Label for leftovers, eat-out, or a no-cook night"),
    servings: z.number().int().positive().optional(),
    attendees: z.array(z.string().uuid()).optional(),
    prepAheadNotes: z.string().optional(),
  })
  .refine((data) => data.planId || data.weekStart, {
    message: "Must provide either planId or weekStart",
  })
  .refine((data) => data.action === "undo" || Boolean(data.date), {
    message: "date is required unless action is undo",
  })
  .refine(
    (data) =>
      data.action === "clear" ||
      data.action === "undo" ||
      Boolean(data.recipeId || data.freeformMeal),
    { message: "set/swap require recipeId or freeformMeal" }
  );

export type EditMealPlanInput = z.infer<typeof editMealPlanSchema>;

async function loadPlan(input: EditMealPlanInput, householdId: string, service: PlanService) {
  if (input.planId) {
    const plan = await service.getMealPlan(input.planId);
    if (!plan || plan.householdId !== householdId) {
      throw new Error("Meal plan not found");
    }
    return plan;
  }
  const plans = await service.listMealPlans(householdId, {
    weekStart: input.weekStart,
    weekEnd: input.weekStart,
  });
  const plan = plans.items[0];
  if (!plan) throw new Error("Meal plan not found");
  return plan;
}

async function handler(input: EditMealPlanInput, context: AuthContext) {
  requireWriteRole(context);
  const db = createDbClient(process.env.DATABASE_URL!);
  const service = new PlanService(db);
  const plan = await loadPlan(input, context.householdId, service);

  if (input.action === "undo") {
    const undone = await service.undoLastPlanEdit(plan.id);
    if (!undone) {
      throw new Error("Nothing to undo");
    }
    const detail = await service.getMealPlanWithEntries(plan.id);
    return {
      id: plan.id,
      action: "undo" as const,
      entries: detail?.entries ?? undone.entries,
      previousEntries: undone.previous,
      message: "Restored the previous meal plan entries",
    };
  }

  const date = input.date!;
  await new RecipeService(db).requireOwnedRecipeIds(context.householdId, [input.recipeId]);
  const patch =
    input.action === "clear"
      ? { date, meal: input.meal, clear: true as const }
      : {
          date,
          meal: input.meal,
          ...(input.recipeId ? { recipeId: input.recipeId } : {}),
          ...(input.freeformMeal ? { freeformMeal: input.freeformMeal } : {}),
          ...(input.servings ? { servings: input.servings } : {}),
          ...(input.attendees ? { attendees: input.attendees } : {}),
          ...(input.prepAheadNotes ? { prepAheadNotes: input.prepAheadNotes } : {}),
        };

  const merged = await service.mergeMealPlanEntries(plan.id, [patch]);
  return {
    id: plan.id,
    action: input.action,
    date,
    meal: input.meal,
    entries: merged.entries,
    previousEntries: merged.previous,
    message:
      input.action === "clear"
        ? `Cleared ${input.meal} on ${date}`
        : `Updated ${input.meal} on ${date}`,
  };
}

export const editMealPlanTool = {
  name: "edit_meal_plan",
  description:
    "Set, swap, or clear a single night on a saved meal plan without rewriting the week. action=undo restores the last entries edit. Freeform labels (leftovers, no-cook) round-trip via freeformMeal.",
  inputSchema: editMealPlanSchema,
  handler,
} as const;
