import { eq, and, isNull, desc, gte, lte } from "drizzle-orm";
import { mealPlan, mealPlanEntry, recipeIngredient, recipe } from "@ovenlovin/db";
import type { MealPlan, MealPlanEntry, MealPlanEntryWrite } from "../schemas/plans";
import type { RecipeIngredient } from "../schemas/recipes";
import type { PaginatedResponse, Pagination } from "../schemas/common";
import { backfillParsedIngredient } from "../parsing/ingredient-line";
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
      status?: string;
      weekStart?: string;
      weekEnd?: string;
      pagination?: Pagination;
    }
  ): Promise<PaginatedResponse<MealPlan>> {
    const { limit } = this.getPaginationParams(options?.pagination);

    let conditions = [eq(mealPlan.householdId, householdId), isNull(mealPlan.deletedAt)];

    if (options?.status) {
      conditions.push(eq(mealPlan.status, options.status as "draft" | "approved" | "archived"));
    }
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
        createdByApiKeyId: data.createdByApiKeyId ?? null,
      })
      .returning();

    if (!created) throw new Error("Failed to create meal plan");
    return this.mapMealPlan(created);
  }

  async updateMealPlan(
    id: string,
    data: Partial<
      Omit<MealPlan, "id" | "createdAt" | "updatedAt" | "deletedAt" | "createdBy" | "householdId">
    >
  ): Promise<MealPlan | null> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updateData: any = { ...data, updatedAt: new Date() };
    if (data.checkedAt !== undefined) {
      updateData.checkedAt = data.checkedAt ? new Date(data.checkedAt) : null;
    }

    const [updated] = await this._db
      .update(mealPlan)
      .set(updateData)
      .where(and(eq(mealPlan.id, id), isNull(mealPlan.deletedAt)))
      .returning();

    return updated ? this.mapMealPlan(updated) : null;
  }

  async deleteMealPlan(id: string): Promise<boolean> {
    const [deleted] = await this._db
      .update(mealPlan)
      .set({ deletedAt: new Date() })
      .where(and(eq(mealPlan.id, id), isNull(mealPlan.deletedAt)))
      .returning();

    return !!deleted;
  }

  async getMealPlanEntries(planId: string): Promise<MealPlanEntry[]> {
    const results = await this._db
      .select()
      .from(mealPlanEntry)
      .where(and(eq(mealPlanEntry.mealPlanId, planId), isNull(mealPlanEntry.deletedAt)))
      .orderBy(mealPlanEntry.date, mealPlanEntry.mealSlot);

    return results.map((r) => this.mapMealPlanEntry(r));
  }

  async replaceMealPlanEntries(
    planId: string,
    entries: MealPlanEntryWrite[]
  ): Promise<MealPlanEntry[]> {
    await this._db
      .update(mealPlanEntry)
      .set({ deletedAt: new Date() })
      .where(and(eq(mealPlanEntry.mealPlanId, planId), isNull(mealPlanEntry.deletedAt)));

    const created: MealPlanEntry[] = [];
    for (const entry of entries) {
      created.push(
        await this.createMealPlanEntry({
          mealPlanId: planId,
          date: entry.date,
          mealSlot: entry.meal,
          recipeId: entry.recipeId ?? null,
          freeformMeal: null,
          servings: entry.servings ?? null,
          attendees: entry.attendees ?? [],
          scaleFactor: 1,
          prepAheadNotes: entry.prepAheadNotes ?? null,
          leftoverSourceId: null,
        })
      );
    }

    await this._db
      .update(mealPlan)
      .set({ needsRecheck: true, updatedAt: new Date() })
      .where(and(eq(mealPlan.id, planId), isNull(mealPlan.deletedAt)));

    return created;
  }

  async getMealPlanWithEntries(
    id: string
  ): Promise<(MealPlan & { entries: MealPlanEntry[] }) | null> {
    const plan = await this.getMealPlan(id);
    if (!plan) return null;
    const entries = await this.getMealPlanEntries(id);
    return { ...plan, entries };
  }

  async createMealPlanEntry(
    data: Omit<MealPlanEntry, "id" | "createdAt" | "updatedAt" | "deletedAt">
  ): Promise<MealPlanEntry> {
    const [created] = await this._db
      .insert(mealPlanEntry)
      .values({
        mealPlanId: data.mealPlanId,
        date: data.date,
        mealSlot: data.mealSlot,
        recipeId: data.recipeId ?? null,
        freeformMeal: data.freeformMeal ?? null,
        servings: data.servings ?? null,
        attendees: data.attendees ?? [],
        scaleFactor: data.scaleFactor ?? 1,
        prepAheadNotes: data.prepAheadNotes ?? null,
        leftoverSourceId: data.leftoverSourceId ?? null,
      })
      .returning();

    if (!created) throw new Error("Failed to create meal plan entry");
    return this.mapMealPlanEntry(created);
  }

  async getRecipeIngredientsForEntry(recipeId: string): Promise<RecipeIngredient[]> {
    const ingredients = await this._db
      .select()
      .from(recipeIngredient)
      .where(and(eq(recipeIngredient.recipeId, recipeId), isNull(recipeIngredient.deletedAt)))
      .orderBy(recipeIngredient.order);

    return ingredients.map((ing) => {
      const parsed = backfillParsedIngredient({
        rawText: ing.rawText,
        quantityMin: ing.quantityMin ? Number(ing.quantityMin) : null,
        quantityMax: ing.quantityMax ? Number(ing.quantityMax) : null,
        unit: ing.unit ?? null,
      });
      return {
        ...ing,
        createdAt: ing.createdAt.toISOString(),
        updatedAt: ing.updatedAt.toISOString(),
        deletedAt: ing.deletedAt?.toISOString() ?? undefined,
        groupId: ing.groupId ?? undefined,
        ingredientId: ing.ingredientId ?? undefined,
        rawText: ing.rawText,
        name: parsed.name,
        quantityMin: parsed.quantityMin ?? undefined,
        quantityMax: parsed.quantityMax ?? undefined,
        unit: parsed.unit ?? undefined,
        originalUnit: ing.originalUnit ?? undefined,
        preparation: ing.preparation ?? undefined,
        isOptional: ing.isOptional ?? false,
        substitutionNotes: ing.substitutionNotes ?? undefined,
        parseConfidence: ing.parseConfidence ? Number(ing.parseConfidence) : undefined,
      };
    });
  }

  async getRecipeTitle(recipeId: string): Promise<string | null> {
    const [result] = await this._db
      .select({ title: recipe.title })
      .from(recipe)
      .where(and(eq(recipe.id, recipeId), isNull(recipe.deletedAt)))
      .limit(1);

    return result?.title ?? null;
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
      createdByApiKeyId: row.createdByApiKeyId ?? null,
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
