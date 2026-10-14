import { and, desc, eq, isNull, lt, sql } from "drizzle-orm";
import { mealPlan, mealPlanEntry, recipe, scheduleOverride, scheduleTemplate } from "@ovenlovin/db";
import { BaseService } from "./base";
import {
  defaultWeeklySchedule,
  normalizeWeeklySchedule,
  templateToWeeklyNight,
  weeklyNightToTemplateValues,
  type HouseholdScheduleView,
  type RecentMeal,
  type ScheduleOverrideView,
  type WeeklyNight,
} from "../schedule/week";

export class ScheduleService extends BaseService {
  async getSchedule(householdId: string): Promise<HouseholdScheduleView> {
    const templates = await this._db
      .select()
      .from(scheduleTemplate)
      .where(
        and(eq(scheduleTemplate.householdId, householdId), isNull(scheduleTemplate.deletedAt))
      );

    const nights = templates
      .map((row) =>
        templateToWeeklyNight({
          dayOfWeek: row.dayOfWeek,
          mealSlot: row.mealSlot,
          busyLevel: row.busyLevel,
          timeBudgetMinutes: row.timeBudgetMinutes,
          attendees: (row.attendees as string[] | null) ?? [],
          constraints: row.constraints,
        })
      )
      .filter((night): night is WeeklyNight => night != null);

    const weeklyTemplate =
      nights.length > 0 ? normalizeWeeklySchedule(nights) : defaultWeeklySchedule();

    const overrideRows = await this._db
      .select()
      .from(scheduleOverride)
      .where(and(eq(scheduleOverride.householdId, householdId), isNull(scheduleOverride.deletedAt)))
      .orderBy(desc(scheduleOverride.date));

    const overrides: ScheduleOverrideView[] = overrideRows.map((row) => ({
      date: row.date ?? "",
      meal: row.mealSlot,
      note: row.reason ?? "",
    }));

    return { weeklyTemplate, overrides };
  }

  async replaceSchedule(
    householdId: string,
    week: unknown,
    createdBy: string
  ): Promise<HouseholdScheduleView> {
    const weeklyTemplate = normalizeWeeklySchedule(week);
    const now = new Date();

    await this._db
      .update(scheduleTemplate)
      .set({ deletedAt: now, updatedAt: now })
      .where(
        and(eq(scheduleTemplate.householdId, householdId), isNull(scheduleTemplate.deletedAt))
      );

    await this._db.insert(scheduleTemplate).values(
      weeklyTemplate.map((night) => ({
        householdId,
        createdBy,
        ...weeklyNightToTemplateValues(night),
      }))
    );

    return this.getSchedule(householdId);
  }

  async listRecentMeals(householdId: string, limit = 14, now = new Date()): Promise<RecentMeal[]> {
    const today = now.toISOString().slice(0, 10);
    const rows = await this._db
      .select({
        date: mealPlanEntry.date,
        meal: mealPlanEntry.mealSlot,
        recipeTitle: recipe.title,
        freeformMeal: mealPlanEntry.freeformMeal,
      })
      .from(mealPlanEntry)
      .innerJoin(mealPlan, eq(mealPlanEntry.mealPlanId, mealPlan.id))
      .leftJoin(recipe, eq(mealPlanEntry.recipeId, recipe.id))
      .where(
        and(
          eq(mealPlan.householdId, householdId),
          isNull(mealPlan.deletedAt),
          isNull(mealPlanEntry.deletedAt),
          lt(mealPlanEntry.date, today)
        )
      )
      .orderBy(desc(mealPlanEntry.date), desc(sql`${mealPlanEntry.createdAt}`))
      .limit(limit);

    return rows
      .map((row) => ({
        date: row.date ?? "",
        meal: row.meal,
        recipeTitle: row.recipeTitle || row.freeformMeal || "Untitled meal",
      }))
      .filter((row) => row.date.length > 0);
  }
}
