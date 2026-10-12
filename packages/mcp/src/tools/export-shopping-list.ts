/**
 * Tool: export_shopping_list
 *
 * Export shopping list for a meal plan in various formats
 */

import { z } from "zod";
import type { AuthContext } from "../auth/index.js";

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
  _input: ExportShoppingListInput,
  _context: AuthContext
): Promise<ExportShoppingListOutput> {
  // TODO: Implement using @ovenlovin/core service
  // - Load plan entries
  // - Aggregate ingredients
  // - Convert units
  // - Group by aisle/recipe/category
  // - Include rule warnings
  // - Format output

  throw new Error("Not implemented: export_shopping_list");
}

export const exportShoppingListTool = {
  name: "export_shopping_list",
  description:
    "Export a shopping list for a meal plan in various formats. Aggregates ingredients, converts units, and includes per-person rule warnings for shoppers.",
  inputSchema: exportShoppingListSchema,
  handler,
} as const;
