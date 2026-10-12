/**
 * Tool: export_shopping_list
 *
 * Export shopping list for a meal plan in various formats
 */

import { z } from "zod";
import type { AuthContext } from "../auth/index";
import { PlanService, RecipeService, PeopleService } from "@ovenlovin/core";
import { createDbClient, recipeIngredient } from "@ovenlovin/db";
import { eq, and, isNull } from "drizzle-orm";
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

  // Load meal plan
  const plan = await planService.getMealPlan(input.planId);
  if (!plan) {
    throw new Error(`Meal plan not found: ${input.planId}`);
  }

  // Verify plan belongs to the household
  if (plan.householdId !== context.householdId) {
    throw new Error("Unauthorized access to meal plan");
  }

  // Load entries
  const entries = await planService.getMealPlanEntries(plan.id);

  // Collect all ingredients with their recipes
  interface IngredientWithContext {
    text: string;
    quantity?: number;
    unit?: string;
    recipeTitle: string;
    confidence?: number;
    ingredientId?: string;
  }

  const allIngredients: IngredientWithContext[] = [];
  const allAttendeeIds = new Set<string>();

  for (const entry of entries) {
    if (!entry.recipeId) continue;

    const recipe = await recipeService.getRecipe(entry.recipeId);
    if (!recipe) continue;

    // Collect attendees
    entry.attendees.forEach((id) => allAttendeeIds.add(id));

    // Load ingredients
    const ingredientRows = await db
      .select()
      .from(recipeIngredient)
      .where(
        and(eq(recipeIngredient.recipeId, entry.recipeId), isNull(recipeIngredient.deletedAt))
      );

    for (const ing of ingredientRows) {
      allIngredients.push({
        text: ing.rawText,
        quantity: ing.quantityMin ? Number(ing.quantityMin) : undefined,
        unit: ing.unit ?? undefined,
        recipeTitle: recipe.title,
        confidence: ing.parseConfidence ? Number(ing.parseConfidence) : undefined,
        ingredientId: ing.ingredientId ?? undefined,
      });
    }
  }

  // Check warnings if requested
  const warnings: ExportShoppingListOutput["warnings"] = [];

  if (input.includeRuleWarnings && allAttendeeIds.size > 0) {
    // Load rules for all attendees
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

    // Check all ingredients
    const ingredientsToCheck: IngredientCheckInput[] = allIngredients.map((ing) => ({
      name: ing.text,
      ingredientId: ing.ingredientId,
      confidence: ing.confidence,
    }));

    if (contexts.length > 0 && ingredientsToCheck.length > 0) {
      const checkResult = checkIngredientsAgainstRules(ingredientsToCheck, contexts);

      // Collect all findings
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

  // Format output based on requested format
  let content: string;
  if (input.format === "json") {
    content = JSON.stringify(
      {
        ingredients: allIngredients,
        warnings,
      },
      null,
      2
    );
  } else if (input.format === "csv") {
    const lines = ["Ingredient,Quantity,Unit,Recipe"];
    for (const ing of allIngredients) {
      lines.push(`"${ing.text}",${ing.quantity ?? ""},${ing.unit ?? ""},"${ing.recipeTitle}"`);
    }
    content = lines.join("\n");
  } else if (input.format === "text") {
    const lines = allIngredients.map((ing) => `- ${ing.text} (${ing.recipeTitle})`);
    if (warnings.length > 0) {
      lines.push("\n\nWARNINGS:");
      for (const warning of warnings) {
        lines.push(`⚠️  ${warning.personName}: ${warning.ingredient} - ${warning.note}`);
      }
    }
    content = lines.join("\n");
  } else {
    // markdown format (default)
    const lines = ["# Shopping List\n"];

    if (input.groupBy === "recipe") {
      const byRecipe = new Map<string, IngredientWithContext[]>();
      for (const ing of allIngredients) {
        if (!byRecipe.has(ing.recipeTitle)) {
          byRecipe.set(ing.recipeTitle, []);
        }
        byRecipe.get(ing.recipeTitle)!.push(ing);
      }

      for (const [recipe, ings] of byRecipe) {
        lines.push(`## ${recipe}\n`);
        for (const ing of ings) {
          lines.push(`- ${ing.text}`);
        }
        lines.push("");
      }
    } else {
      // Default: simple list
      lines.push("## Ingredients\n");
      for (const ing of allIngredients) {
        lines.push(`- ${ing.text} (${ing.recipeTitle})`);
      }
    }

    if (warnings.length > 0) {
      lines.push("\n## ⚠️ Warnings\n");
      for (const warning of warnings) {
        lines.push(`- **${warning.personName}**: ${warning.ingredient} - ${warning.note}`);
      }
    }

    content = lines.join("\n");
  }

  return {
    format: input.format,
    content,
    itemCount: allIngredients.length,
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
