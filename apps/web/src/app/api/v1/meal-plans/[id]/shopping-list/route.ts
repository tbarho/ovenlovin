import { NextRequest, NextResponse } from "next/server";
import { handleApiError, NotFoundError, BadRequestError } from "@/lib/api/errors";
import { getRequestContext, requireHouseholdId } from "@/lib/api/middleware";
import {
  PlanService,
  RecipeService,
  ShoppingListService,
  collectShoppingListEntries,
  resolveIncludeStaples,
  type ShoppingListGroupBy,
} from "@ovenlovin/core";
import { getDatabase } from "@ovenlovin/db";

const FORMATS = ["json", "csv", "markdown", "text"] as const;
const GROUP_BY = ["aisle", "recipe", "category"] as const;

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await getRequestContext(request);
    requireHouseholdId(context);

    const { id } = await params;
    const url = new URL(request.url);
    const format = url.searchParams.get("format") || "json";
    const groupBy = (url.searchParams.get("groupBy") || "aisle") as ShoppingListGroupBy;
    const includeStaples = resolveIncludeStaples({
      includeStaples: url.searchParams.has("includeStaples")
        ? url.searchParams.get("includeStaples") === "true"
        : undefined,
      includePantryItems: url.searchParams.has("includePantryItems")
        ? url.searchParams.get("includePantryItems") === "true"
        : undefined,
    });

    if (!FORMATS.includes(format as (typeof FORMATS)[number])) {
      throw new BadRequestError("Invalid format. Must be one of: json, csv, markdown, text");
    }
    if (!GROUP_BY.includes(groupBy)) {
      throw new BadRequestError("Invalid groupBy. Must be one of: aisle, recipe, category");
    }

    const db = getDatabase();
    const planService = new PlanService(db);
    const recipeService = new RecipeService(db);
    const shoppingListService = new ShoppingListService();

    const plan = await planService.getMealPlan(id);
    if (!plan) {
      throw new NotFoundError("MealPlan", id);
    }

    const entries = await planService.getMealPlanEntries(id);
    const sources = await collectShoppingListEntries(entries, {
      getRecipe: (recipeId) => recipeService.getRecipe(recipeId),
      getIngredients: async (recipeId) => {
        const rows = await planService.getRecipeIngredientsForEntry(recipeId);
        return rows.map((ing) => ({
          rawText: ing.rawText,
          name: ing.name,
          quantityMin: ing.quantityMin,
          unit: ing.unit,
          ingredientId: ing.ingredientId,
        }));
      },
    });

    const shoppingList = shoppingListService.build({
      mealPlanId: plan.id,
      weekStart: plan.weekStart,
      entries: sources,
      groupBy,
      includeStaples,
    });

    const output = shoppingListService.format(
      shoppingList,
      format as "json" | "csv" | "markdown" | "text"
    );
    const contentType =
      format === "csv"
        ? "text/csv"
        : format === "markdown"
          ? "text/markdown"
          : format === "text"
            ? "text/plain"
            : "application/json";

    return new NextResponse(output, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="shopping-list-${plan.weekStart}.${format}"`,
      },
    });
  } catch (error) {
    return handleApiError(error, request.url);
  }
}
