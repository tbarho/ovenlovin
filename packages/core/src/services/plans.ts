import { eq, and, isNull, desc, gte, lte } from "drizzle-orm";
import { mealPlan, mealPlanEntry, checkResult } from "@ovenlovin/db";
import type { MealPlan, MealPlanEntry, CheckReport, CheckFinding } from "../schemas/plans";
import type { PersonRule } from "../schemas/people";
import type { PaginatedResponse, Pagination } from "../schemas/common";
import { BaseService } from "./base";

export class PlanService extends BaseService {
  async getMealPlan(id: string): Promise<MealPlan | null> {
    const [result] = await this._db
      .select()
      .from(mealPlan)
      .where(and(eq(mealPlan.id, id), isNull(mealPlan.deletedAt)))
      .limit(1);

    return result ? this.mapMealPlan(result) : null;
  }

  async listMealPlans(
    householdId: string,
    options?: {
      weekStart?: string;
      weekEnd?: string;
      pagination?: Pagination;
    }
  ): Promise<PaginatedResponse<MealPlan>> {
    const { limit } = this.getPaginationParams(options?.pagination);

    let conditions = [eq(mealPlan.householdId, householdId), isNull(mealPlan.deletedAt)];

    if (options?.weekStart) {
      conditions.push(gte(mealPlan.weekStart, options.weekStart));
    }
    if (options?.weekEnd) {
      conditions.push(lte(mealPlan.weekStart, options.weekEnd));
    }

    const results = await this._db
      .select()
      .from(mealPlan)
      .where(and(...conditions))
      .orderBy(desc(mealPlan.weekStart))
      .limit(limit + 1);

    const plans = results.map((r) => this.mapMealPlan(r));

    return this.buildPaginatedResponse(plans, limit);
  }

  async createMealPlan(
    data: Omit<MealPlan, "id" | "createdAt" | "updatedAt" | "deletedAt">
  ): Promise<MealPlan> {
    const [created] = await this._db
      .insert(mealPlan)
      .values({
        householdId: data.householdId,
        weekStart: data.weekStart,
        status: data.status ?? "draft",
        generator: data.generator ?? null,
        generatorModel: data.generatorModel ?? null,
        latestCheckReport: data.latestCheckReport ?? null,
        checkedAt: data.checkedAt ? new Date(data.checkedAt) : null,
        contentHash: data.contentHash ?? null,
        acknowledgedWarnings: data.acknowledgedWarnings ?? [],
        needsRecheck: data.needsRecheck ?? false,
        createdBy: data.createdBy,
      })
      .returning();

    if (!created) throw new Error("Failed to create meal plan");
    return this.mapMealPlan(created);
  }

  async getMealPlanEntries(planId: string): Promise<MealPlanEntry[]> {
    const results = await this._db
      .select()
      .from(mealPlanEntry)
      .where(and(eq(mealPlanEntry.mealPlanId, planId), isNull(mealPlanEntry.deletedAt)))
      .orderBy(mealPlanEntry.date, mealPlanEntry.mealSlot);

    return results.map((r) => this.mapMealPlanEntry(r));
  }

  async checkMealPlan(
    plan: MealPlan,
    entries: MealPlanEntry[],
    peopleRules: Map<string, PersonRule[]>
  ): Promise<CheckReport> {
    const findings: CheckFinding[] = [];
    const affectedPeopleSet = new Set<string>();

    for (const entry of entries) {
      for (const personId of entry.attendees) {
        const rules = peopleRules.get(personId) || [];

        for (const rule of rules) {
          const finding = await this.checkEntryAgainstRule(entry, personId, rule);
          if (finding) {
            findings.push(finding);
            affectedPeopleSet.add(personId);
          }
        }
      }
    }

    const blockCount = findings.filter((f) => f.severity === "block").length;
    const warnCount = findings.filter((f) => f.severity === "warn").length;

    return {
      status: "complete",
      planId: plan.id,
      checkedAt: new Date().toISOString(),
      findings,
      incompleteReasons: [],
      summary: {
        totalEntries: entries.length,
        entriesWithBlocks: new Set(
          findings.filter((f) => f.severity === "block").map((f) => f.entryId)
        ).size,
        entriesWithWarnings: new Set(
          findings.filter((f) => f.severity === "warn").map((f) => f.entryId)
        ).size,
        affectedPeople: Array.from(affectedPeopleSet),
      },
    };
  }

  private async checkEntryAgainstRule(
    entry: MealPlanEntry,
    personId: string,
    rule: PersonRule
  ): Promise<CheckFinding | null> {
    return null;
  }

  private mapMealPlan(row: typeof mealPlan.$inferSelect): MealPlan {
    return {
      id: row.id,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      deletedAt: row.deletedAt?.toISOString() ?? null,
      createdBy: row.createdBy,
      householdId: row.householdId,
      weekStart: row.weekStart ?? "",
      status: row.status,
      generator: row.generator ?? null,
      generatorModel: row.generatorModel ?? null,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      latestCheckReport: row.latestCheckReport as any,
      checkedAt: row.checkedAt?.toISOString() ?? null,
      contentHash: row.contentHash ?? null,
      acknowledgedWarnings: (row.acknowledgedWarnings as string[]) ?? [],
      needsRecheck: row.needsRecheck ?? false,
    };
  }

  private mapMealPlanEntry(row: typeof mealPlanEntry.$inferSelect): MealPlanEntry {
    return {
      id: row.id,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      deletedAt: row.deletedAt?.toISOString() ?? null,
      mealPlanId: row.mealPlanId,
      date: row.date ?? "",
      mealSlot: row.mealSlot,
      recipeId: row.recipeId ?? null,
      freeformMeal: row.freeformMeal ?? null,
      servings: row.servings ?? null,
      attendees: (row.attendees as string[]) ?? [],
      scaleFactor: row.scaleFactor ?? 1,
      prepAheadNotes: row.prepAheadNotes ?? null,
      leftoverSourceId: row.leftoverSourceId ?? null,
    };
  }
}
