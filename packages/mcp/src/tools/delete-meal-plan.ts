import { z } from "zod";
import type { AuthContext } from "../auth/index";
import { requireWriteRole } from "../auth/index";
import { PlanService } from "@ovenlovin/core";
import { createDbClient } from "@ovenlovin/db";

export const deleteMealPlanSchema = z.object({
  id: z.string().uuid(),
});

async function handler(input: z.infer<typeof deleteMealPlanSchema>, context: AuthContext) {
  requireWriteRole(context);
  const db = createDbClient(process.env.DATABASE_URL!);
  const plans = new PlanService(db);
  const existing = await plans.getMealPlan(input.id);
  if (!existing || existing.householdId !== context.householdId) {
    throw new Error(`Meal plan not found: ${input.id}`);
  }
  const deleted = await plans.deleteMealPlan(input.id);
  return { id: input.id, deleted };
}

export const deleteMealPlanTool = {
  name: "delete_meal_plan",
  description: "Soft-delete a meal plan in this household.",
  inputSchema: deleteMealPlanSchema,
  handler,
} as const;
