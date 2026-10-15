import { NextRequest } from "next/server";
import { handleApiError, NotFoundError, requireResourceId } from "@/lib/api/errors";
import { jsonResponse } from "@/lib/api/response";
import { getRequestContext, requireHouseholdId } from "@/lib/api/middleware";
import {
  PlanService,
  PeopleService,
  RecipeService,
  ScheduleService,
  nightForDate,
  recipeTotalTimeMinutes,
  scheduleIssuesForNight,
} from "@ovenlovin/core";
import { getDatabase } from "@ovenlovin/db";
import {
  checkMealPlan,
  type MealPlanCheckInput,
  type MealPlanEntryInput,
  type IngredientCheckInput,
  type PersonWithRules,
} from "@ovenlovin/allergens";

async function handleCheck(request: NextRequest, params: Promise<{ id: string }>, persist = false) {
  const context = await getRequestContext(request);
  const householdId = requireHouseholdId(context);

  const { id } = await params;
  requireResourceId("MealPlan", id);

  const db = getDatabase();
  const planService = new PlanService(db);
  const peopleService = new PeopleService(db);
  const recipeService = new RecipeService(db);
  const schedule = await new ScheduleService(db).getSchedule(householdId);
  const recipeMinutesByEntryId = new Map<string, number | null>();

  const plan = await planService.getMealPlan(id);
  if (!plan || plan.householdId !== householdId) {
    throw new NotFoundError("MealPlan", id);
  }

  const entries = await planService.getMealPlanEntries(id);

  const entryInputs: MealPlanEntryInput[] = await Promise.all(
    entries.map(async (entry) => {
      let ingredients: IngredientCheckInput[] = [];
      let recipeTitle: string | undefined;

      if (entry.recipeId) {
        const ingredientRows = await planService.getRecipeIngredientsForEntry(entry.recipeId);
        ingredients = ingredientRows.map((ing) => ({
          name: ing.rawText,
        }));
        const recipe = await recipeService.getRecipe(entry.recipeId);
        recipeTitle =
          recipe?.title ?? (await planService.getRecipeTitle(entry.recipeId)) ?? undefined;
        recipeMinutesByEntryId.set(entry.id, recipeTotalTimeMinutes(recipe));
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

  const attendeeIds = new Set<string>();
  for (const entry of entries) {
    for (const attendeeId of entry.attendees) {
      attendeeIds.add(attendeeId);
    }
  }

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

  const checkInput: MealPlanCheckInput = {
    entries: entryInputs,
    people: peopleWithRules,
  };

  const checkResult = checkMealPlan(checkInput);
  const checkedAt = new Date().toISOString();
  const report = {
    status: checkResult.status,
    planId: id,
    checkedAt,
    byEntry: checkResult.byEntry.map((entry) => {
      const stored = entries.find((row) => row.id === entry.entryId);
      const scheduleIssues = scheduleIssuesForNight({
        date: entry.date,
        recipeTitle: entry.recipeTitle ?? entry.freeformMeal ?? "This recipe",
        recipeTotalMinutes: recipeMinutesByEntryId.get(entry.entryId) ?? null,
        night: nightForDate(schedule.weeklyTemplate, entry.date),
        plannedCooking: Boolean(stored?.recipeId),
      });
      return {
        ...entry,
        scheduleIssues: scheduleIssues.length > 0 ? scheduleIssues : undefined,
      };
    }),
    byPerson: checkResult.byPerson,
    summary: checkResult.summary,
    incompleteReasons: checkResult.incompleteReasons,
  };

  if (persist) {
    await planService.updateMealPlan(id, {
      latestCheckReport: report,
      checkedAt,
      needsRecheck: false,
    });
  }

  return jsonResponse(report);
}

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    return await handleCheck(request, context.params, false);
  } catch (error) {
    return handleApiError(error, request.url);
  }
}

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    return await handleCheck(request, context.params, true);
  } catch (error) {
    return handleApiError(error, request.url);
  }
}
