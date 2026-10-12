import { NextRequest } from "next/server";
import { handleApiError, NotFoundError } from "@/lib/api/errors";
import { jsonResponse } from "@/lib/api/response";
import { getRequestContext, requireHouseholdId } from "@/lib/api/middleware";
import { PlanService, PeopleService } from "@ovenlovin/core";
import { getDatabase } from "@ovenlovin/db";
import { checkMealPlan, type MealPlanCheckInput, type MealPlanEntryInput, type PersonWithRules } from "@ovenlovin/allergens";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await getRequestContext(request);
    requireHouseholdId(context);

    const { id } = await params;

    const db = getDatabase();
    const planService = new PlanService(db);
    const peopleService = new PeopleService(db);

    // Get the meal plan
    const plan = await planService.getMealPlan(id);
    if (!plan) {
      throw new NotFoundError("MealPlan", id);
    }

    // Get the meal plan entries
    const entries = await planService.getMealPlanEntries(id);

    // Build entry inputs for the checker
    const entryInputs: MealPlanEntryInput[] = await Promise.all(
      entries.map(async (entry) => {
        let ingredients = [];
        let recipeTitle: string | undefined;

        if (entry.recipeId) {
          ingredients = await planService.getRecipeIngredientsForEntry(entry.recipeId);
          recipeTitle = (await planService.getRecipeTitle(entry.recipeId)) ?? undefined;
        }

        return {
          id: entry.id,
          date: entry.date,
          mealSlot: entry.mealSlot,
          recipeId: entry.recipeId ?? undefined,
          recipeTitle,
          freeformMeal: entry.freeformMeal ?? undefined,
          attendees: entry.attendees,
          ingredients,
        };
      })
    );

    // Get all unique attendees across all entries
    const attendeeIds = new Set<string>();
    for (const entry of entries) {
      for (const attendeeId of entry.attendees) {
        attendeeIds.add(attendeeId);
      }
    }

    // Get people with their rules
    const peopleWithRules: PersonWithRules[] = await Promise.all(
      Array.from(attendeeIds).map(async (personId) => {
        const person = await peopleService.getPerson(personId);
        const rules = await peopleService.getRulesForPerson(personId);

        return {
          id: personId,
          name: person?.displayName ?? "Unknown",
          rules,
        };
      })
    );

    // Check the meal plan
    const checkInput: MealPlanCheckInput = {
      entries: entryInputs,
      people: peopleWithRules,
    };

    const checkResult = checkMealPlan(checkInput);

    // Transform the result to match the expected API response format
    // Group findings by severity for easy consumption
    const response = {
      status: checkResult.status,
      planId: id,
      checkedAt: new Date().toISOString(),
      byEntry: checkResult.byEntry,
      byPerson: checkResult.byPerson,
      summary: checkResult.summary,
      incompleteReasons: checkResult.incompleteReasons,
    };

    return jsonResponse(response);
  } catch (error) {
    return handleApiError(error, request.url);
  }
}
