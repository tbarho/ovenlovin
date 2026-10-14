/**
 * Tool: export_shopping_list
 *
 * Export shopping list for a meal plan in various formats
 */

import { z } from "zod";
import type { AuthContext } from "../auth/index";
import {
  PlanService,
  RecipeService,
  PeopleService,
  ShoppingListService,
  collectShoppingListEntries,
} from "@ovenlovin/core";
import { createDbClient } from "@ovenlovin/db";
import {
  checkIngredientsAgainstRules,
  type RuleCheckContext,
  type IngredientCheckInput,
} from "@ovenlovin/allergens";

export const exportShoppingListSchema = z.object({
  planId: z.string().uuid(),
  format: z.enum(["json", "csv", "markdown", "text"]).default("markdown"),
  groupBy: z.enum(["aisle", "recipe", "category"]).default("aisle"),
  includePantryItems: z.boolean().default(false),
  includeRuleWarnings: z.boolean().default(true),
});

export type ExportShoppingListInput = z.infer<typeof exportShoppingListSchema>;

export interface ExportShoppingListOutput {
  format: string;
  content: string;
  itemCount: number;
  warnings: Array<{
    ingredient: string;
    personName: string;
    note: string;
  }>;
}

async function handler(
  input: ExportShoppingListInput,
  context: AuthContext
): Promise<ExportShoppingListOutput> {
  const db = createDbClient(process.env.DATABASE_URL!);
  const planService = new PlanService(db);
  const recipeService = new RecipeService(db);
  const peopleService = new PeopleService(db);
  const shoppingListService = new ShoppingListService();

  const plan = await planService.getMealPlan(input.planId);
  if (!plan) {
    throw new Error(`Meal plan not found: ${input.planId}`);
  }

  if (plan.householdId !== context.householdId) {
    throw new Error("Unauthorized access to meal plan");
  }

  const entries = await planService.getMealPlanEntries(plan.id);
  const sources = await collectShoppingListEntries(entries, {
    getRecipe: (id) => recipeService.getRecipe(id),
    getIngredients: async (id) => {
      const rows = await planService.getRecipeIngredientsForEntry(id);
      return rows.map((ing) => ({
        rawText: ing.rawText,
        name: ing.name,
        quantityMin: ing.quantityMin,
        unit: ing.unit,
        ingredientId: ing.ingredientId,
      }));
    },
  });

  const warnings: ExportShoppingListOutput["warnings"] = [];
  const allAttendeeIds = new Set<string>();
  for (const entry of entries) {
    entry.attendees.forEach((id) => allAttendeeIds.add(id));
  }

  if (input.includeRuleWarnings && allAttendeeIds.size > 0) {
    const contexts: RuleCheckContext[] = [];
    for (const personId of allAttendeeIds) {
      const person = await peopleService.getPerson(personId);
      if (!person || person.householdId !== context.householdId) continue;

      const rules = await peopleService.getRulesForPerson(personId);
      for (const rule of rules) {
        contexts.push({
          personId: person.id,
          personName: person.displayName,
          rule,
        });
      }
    }

    const ingredientsToCheck: IngredientCheckInput[] = sources.flatMap((source) =>
      source.ingredients.map((ing) => ({
        name: ing.name || ing.rawText,
        ingredientId: ing.ingredientId ?? undefined,
      }))
    );

    if (contexts.length > 0 && ingredientsToCheck.length > 0) {
      const checkResult = checkIngredientsAgainstRules(ingredientsToCheck, contexts);
      for (const finding of [
        ...checkResult.findings.block,
        ...checkResult.findings.warn,
        ...checkResult.findings.prefer_avoid,
      ]) {
        warnings.push({
          ingredient: finding.ingredientName,
          personName: finding.personName,
          note: finding.message,
        });
      }
    }
  }

  const shoppingList = shoppingListService.build({
    mealPlanId: plan.id,
    weekStart: plan.weekStart,
    entries: sources,
    groupBy: input.groupBy,
    includePantryItems: input.includePantryItems,
    warnings,
  });

  return {
    format: input.format,
    content: shoppingListService.format(shoppingList, input.format),
    itemCount: shoppingList.itemCount,
    warnings,
  };
}

export const exportShoppingListTool = {
  name: "export_shopping_list",
  description:
    "Export a shopping list for a meal plan in various formats. Aggregates ingredients, converts units, and includes per-person rule warnings for shoppers.",
  inputSchema: exportShoppingListSchema,
  handler,
} as const;
