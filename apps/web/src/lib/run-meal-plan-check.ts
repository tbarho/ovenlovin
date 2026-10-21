import {
  PeopleService,
  PlanService,
  RecipeService,
  ScheduleService,
  nightForDate,
  planEntriesForWeek,
  recipeTotalTimeMinutes,
  scheduleIssuesForNight,
} from "@ovenlovin/core";
import { getDatabase } from "@ovenlovin/db";
import {
  checkMealPlan,
  personIdsForPlanCheck,
  type IngredientCheckInput,
  type MealPlanCheckInput,
  type MealPlanEntryInput,
  type PersonWithRules,
} from "@ovenlovin/allergens";
import { NotFoundError, requireResourceId } from "@/lib/api/errors";

export async function persistMealPlanCheck(planId: string, householdId: string) {
  const report = await runMealPlanCheck(planId, householdId);
  const db = getDatabase();
  const planService = new PlanService(db);
  await planService.updateMealPlan(planId, {
    latestCheckReport: report,
    checkedAt: report.checkedAt,
    needsRecheck: false,
  });
  return report;
}

export async function runMealPlanCheck(planId: string, householdId: string) {
  const db = getDatabase();
  const planService = new PlanService(db);
  const peopleService = new PeopleService(db);
  const recipeService = new RecipeService(db);
  const schedule = await new ScheduleService(db).getSchedule(householdId);
  const recipeMinutesByEntryId = new Map<string, number | null>();

  requireResourceId("MealPlan", planId);
  const plan = await planService.getMealPlan(planId);
  if (!plan || plan.householdId !== householdId) {
    throw new NotFoundError("MealPlan", planId);
  }

  const entries = planEntriesForWeek(await planService.getMealPlanEntries(planId), plan.weekStart);

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

  const householdPeople = await peopleService.listPeopleByHousehold(householdId, { limit: 40 });
  const attendeeIds = personIdsForPlanCheck(
    entries.flatMap((entry) => entry.attendees),
    householdPeople.items.map((person) => person.id)
  );

  const peopleWithRules: PersonWithRules[] = [];
  for (const personId of attendeeIds) {
    const fromHousehold = householdPeople.items.find((item) => item.id === personId);
    const person = fromHousehold ?? (await peopleService.getPerson(personId));
    if (!person || person.householdId !== householdId) continue;
    peopleWithRules.push({
      id: personId,
      name: person.displayName,
      rules: await peopleService.getRulesForPerson(personId),
    });
  }

  const checkInput: MealPlanCheckInput = {
    entries: entryInputs,
    people: peopleWithRules,
  };

  const checkResult = checkMealPlan(checkInput);
  const checkedAt = new Date().toISOString();
  return {
    status: checkResult.status,
    planId,
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
}
