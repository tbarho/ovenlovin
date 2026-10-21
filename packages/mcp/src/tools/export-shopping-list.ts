/**
 * Tool: export_shopping_list
 *
 * Export shopping list for a meal plan in various formats
 */

import { z } from "zod";
import type { AuthContext } from "../auth/index";
import {
  HouseholdService,
  PlanService,
  RecipeService,
  PeopleService,
  ShoppingListService,
  applyShoppingTrip,
  collectShoppingListEntries,
  parseIanaTimeZone,
  parseShoppingTripState,
  planEntriesForWeek,
  resolveIncludeStaples,
  weekCookFor,
  type ShoppingListData,
} from "@ovenlovin/core";
import { createDbClient } from "@ovenlovin/db";
import {
  checkIngredientsAgainstRules,
  collapseRuleFindings,
  type RuleCheckContext,
  type IngredientCheckInput,
} from "@ovenlovin/allergens";

export const exportShoppingListSchema = z.object({
  planId: z.string().uuid(),
  format: z.enum(["json", "csv", "markdown", "text"]).default("markdown"),
  groupBy: z.enum(["aisle", "recipe", "category"]).default("aisle"),
  includeStaples: z
    .boolean()
    .optional()
    .describe(
      "Include kitchen staples such as salt, pepper, and oil. Distinct from the pantry food-taxonomy category. Alias: includePantryItems."
    ),
  includePantryItems: z.boolean().optional().describe("Deprecated alias for includeStaples."),
  includeRuleWarnings: z.boolean().default(true),
  timeZone: z
    .string()
    .min(1)
    .optional()
    .describe(
      "IANA timezone for the markdown/text Generated line (for example America/Chicago). Default: kitchen server timezone, always labeled."
    ),
});

export type ExportShoppingListInput = z.infer<typeof exportShoppingListSchema>;

export interface ExportShoppingListOutput {
  format: string;
  /** Markdown, CSV, or plain text. Omitted for `json` - use `list` instead. */
  content?: string;
  /** Structured shopping list. Always present so MCP does not double-encode JSON. */
  list: ShoppingListData;
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
  if (!plan || plan.householdId !== context.householdId) {
    throw new Error(`Meal plan not found: ${input.planId}`);
  }

  const entries = planEntriesForWeek(await planService.getMealPlanEntries(plan.id), plan.weekStart);
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
      const seen = new Set<string>();
      for (const finding of collapseRuleFindings([
        ...checkResult.findings.block,
        ...checkResult.findings.warn,
        ...checkResult.findings.prefer_avoid,
      ])) {
        const key = `${finding.personName}\0${finding.message}`;
        if (seen.has(key)) continue;
        seen.add(key);
        warnings.push({
          ingredient: finding.ingredientName,
          personName: finding.personName,
          note: finding.message,
        });
      }
    }
  }

  if (input.timeZone && !parseIanaTimeZone(input.timeZone)) {
    throw new Error("Invalid timeZone. Use an IANA name such as America/Chicago.");
  }

  const servingsSettings = await new HouseholdService(db).loadKitchenServingsSettings(
    context.householdId
  );

  const shoppingList = applyShoppingTrip(
    shoppingListService.build({
      mealPlanId: plan.id,
      weekStart: plan.weekStart,
      entries: sources,
      groupBy: input.groupBy,
      includeStaples: resolveIncludeStaples(input),
      warnings,
      defaultCookFor: weekCookFor({
        planCookFor: plan.cookFor,
        householdCookFor: servingsSettings.defaultCookFor,
      }),
      mode: servingsSettings.mode,
    }),
    parseShoppingTripState(plan.shoppingState)
  );

  return {
    format: input.format,
    list: shoppingList,
    content:
      input.format === "json"
        ? undefined
        : shoppingListService.format(shoppingList, input.format, { timeZone: input.timeZone }),
    itemCount: shoppingList.itemCount,
    warnings,
  };
}

export const exportShoppingListTool = {
  name: "export_shopping_list",
  description:
    "Export a shopping list for a meal plan. Returns structured `list` (object, never a JSON string) plus optional markdown/csv/text `content`. Includes saved check-offs ([x] vs [ ]) and extras such as paper towels. Canonical staple flag is includeStaples / item isStaple; includePantryItems and isPantryItem are aliases. Generated timestamps use timeZone (IANA) and always include a zone label. Aggregates ingredients, converts units, and includes per-person rule warnings for shoppers.",
  inputSchema: exportShoppingListSchema,
  handler,
} as const;
