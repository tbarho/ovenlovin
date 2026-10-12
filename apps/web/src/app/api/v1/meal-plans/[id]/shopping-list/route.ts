import { NextRequest, NextResponse } from "next/server";
import { handleApiError, NotFoundError, BadRequestError } from "@/lib/api/errors";
import { getRequestContext, requireHouseholdId } from "@/lib/api/middleware";
import { PlanService, ShoppingListService } from "@ovenlovin/core";
import { getDatabase } from "@ovenlovin/db";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await getRequestContext(request);
    requireHouseholdId(context);

    const { id } = await params;
    const url = new URL(request.url);
    const format = url.searchParams.get("format") || "json";

    if (!["json", "csv", "markdown", "text"].includes(format)) {
      throw new BadRequestError(
        "Invalid format. Must be one of: json, csv, markdown, text"
      );
    }

    const db = getDatabase();
    const planService = new PlanService(db);
    const shoppingListService = new ShoppingListService();

    const plan = await planService.getMealPlan(id);
    if (!plan) {
      throw new NotFoundError("MealPlan", id);
    }

    const entries = await planService.getMealPlanEntries(id);

    const entriesWithIngredients = await Promise.all(
      entries.map(async (entry) => {
        if (!entry.recipeId) {
          return {
            entry,
            recipeTitle: entry.freeformMeal ?? undefined,
            ingredients: [],
          };
        }

        const ingredients = await planService.getRecipeIngredientsForEntry(entry.recipeId);
        const recipeTitle = await planService.getRecipeTitle(entry.recipeId);

        return {
          entry,
          recipeTitle: recipeTitle ?? undefined,
          ingredients,
        };
      })
    );

    const aggregatedIngredients = shoppingListService.aggregateIngredients(
      entriesWithIngredients
    );

    const shoppingListData = {
      mealPlanId: plan.id,
      weekStart: plan.weekStart,
      ingredients: aggregatedIngredients,
      generatedAt: new Date().toISOString(),
    };

    let output: string;
    let contentType: string;

    switch (format) {
      case "csv":
        output = shoppingListService.exportAsCSV(shoppingListData);
        contentType = "text/csv";
        break;
      case "markdown":
        output = shoppingListService.exportAsMarkdown(shoppingListData);
        contentType = "text/markdown";
        break;
      case "text":
        output = shoppingListService.exportAsText(shoppingListData);
        contentType = "text/plain";
        break;
      case "json":
      default:
        output = shoppingListService.exportAsJSON(shoppingListData);
        contentType = "application/json";
        break;
    }

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
