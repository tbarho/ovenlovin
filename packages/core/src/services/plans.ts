import { randomUUID } from "node:crypto";
import { eq, and, isNull, desc, gte, lte, inArray } from "drizzle-orm";
import { mealPlan, mealPlanEntry, recipeIngredient, recipe } from "@ovenlovin/db";
import type {
  MealPlan,
  MealPlanEntry,
  MealPlanEntryPatch,
  MealPlanEntryWrite,
  MealPlanRevision,
} from "../schemas/plans";
import { mealPlanEntryWriteFromRow, planMealPlanEntryMerge } from "../plans/merge-entries";
import { parseShoppingTripState } from "../schemas/shopping-trip";
import type { RecipeIngredient } from "../schemas/recipes";
import type { PaginatedResponse, Pagination } from "../schemas/common";
import { backfillParsedIngredient } from "../parsing/ingredient-line";
import { scaleFactorForPlanEntry } from "../scaling/servings";
import { BaseService } from "./base";
import { liveEntriesForPlanRead } from "./plan-week-entries";

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
        cookFor: data.cookFor ?? null,
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
    entries: MealPlanEntryWrite[],
    options?: { recordHistory?: boolean }
  ): Promise<MealPlanEntry[]> {
    if (options?.recordHistory !== false) {
      await this.recordPlanRevision(planId, "replace");
    }
    await this._db
      .update(mealPlanEntry)
      .set({ deletedAt: new Date() })
      .where(and(eq(mealPlanEntry.mealPlanId, planId), isNull(mealPlanEntry.deletedAt)));

    const recipeIds = [
      ...new Set(entries.map((entry) => entry.recipeId).filter((id): id is string => Boolean(id))),
    ];
    const servingsByRecipe = await this.getRecipeServingsByIds(recipeIds);
    const created = await Promise.all(
      entries.map((entry) =>
        this.createMealPlanEntry(
          {
            mealPlanId: planId,
            date: entry.date,
            mealSlot: entry.meal,
            recipeId: entry.recipeId ?? null,
            freeformMeal: entry.freeformMeal ?? null,
            servings: entry.servings ?? null,
            attendees: entry.attendees ?? [],
            prepAheadNotes: entry.prepAheadNotes ?? null,
            leftoverSourceId: null,
          },
          entry.recipeId ? (servingsByRecipe.get(entry.recipeId) ?? null) : null
        )
      )
    );

    await this._db
      .update(mealPlan)
      .set({ needsRecheck: true, updatedAt: new Date() })
      .where(and(eq(mealPlan.id, planId), isNull(mealPlan.deletedAt)));

    return created;
  }

  async mergeMealPlanEntries(
    planId: string,
    patches: MealPlanEntryPatch[]
  ): Promise<{ entries: MealPlanEntry[]; previous: MealPlanEntry[] }> {
    const existing = await this.getMealPlanEntries(planId);
    const plan = planMealPlanEntryMerge(existing, patches);
    if (plan.clearIds.length > 0 || plan.upserts.length > 0) {
      await this.recordPlanRevision(planId, "merge", existing);
    }

    if (plan.clearIds.length > 0) {
      await this._db
        .update(mealPlanEntry)
        .set({ deletedAt: new Date(), updatedAt: new Date() })
        .where(inArray(mealPlanEntry.id, plan.clearIds));
    }

    for (const { existing: current, next } of plan.upserts) {
      if (current) {
        await this.updateMealPlanEntry(current.id, next);
      } else {
        await this.createMealPlanEntry({
          mealPlanId: planId,
          date: next.date,
          mealSlot: next.meal,
          recipeId: next.recipeId ?? null,
          freeformMeal: next.freeformMeal ?? null,
          servings: next.servings ?? null,
          attendees: next.attendees ?? [],
          prepAheadNotes: next.prepAheadNotes ?? null,
          leftoverSourceId: null,
        });
      }
    }

    if (plan.clearIds.length > 0 || plan.upserts.length > 0) {
      await this._db
        .update(mealPlan)
        .set({ needsRecheck: true, updatedAt: new Date() })
        .where(and(eq(mealPlan.id, planId), isNull(mealPlan.deletedAt)));
    }

    return { entries: await this.getMealPlanEntries(planId), previous: plan.previous };
  }

  async updateMealPlanEntry(id: string, patch: MealPlanEntryWrite): Promise<MealPlanEntry | null> {
    const recipeServings = patch.recipeId ? await this.getRecipeServings(patch.recipeId) : null;
    const scaleFactor = scaleFactorForPlanEntry(patch.servings ?? null, recipeServings);
    const [updated] = await this._db
      .update(mealPlanEntry)
      .set({
        date: patch.date,
        mealSlot: patch.meal,
        recipeId: patch.recipeId ?? null,
        freeformMeal: patch.freeformMeal ?? null,
        servings: patch.servings ?? null,
        attendees: patch.attendees ?? [],
        scaleFactor: String(scaleFactor),
        prepAheadNotes: patch.prepAheadNotes ?? null,
        leftoverSourceId: null,
        updatedAt: new Date(),
      })
      .where(and(eq(mealPlanEntry.id, id), isNull(mealPlanEntry.deletedAt)))
      .returning();

    return updated ? this.mapMealPlanEntry(updated) : null;
  }

  async getPlanHistory(planId: string): Promise<MealPlanRevision[]> {
    const [row] = await this._db
      .select({ editHistory: mealPlan.editHistory })
      .from(mealPlan)
      .where(and(eq(mealPlan.id, planId), isNull(mealPlan.deletedAt)))
      .limit(1);
    const history = (row?.editHistory ?? []) as MealPlanRevision[];
    return [...history].reverse();
  }

  async recordPlanRevision(
    planId: string,
    action: MealPlanRevision["action"],
    existing?: MealPlanEntry[]
  ): Promise<void> {
    const entries = existing ?? (await this.getMealPlanEntries(planId));
    const [row] = await this._db
      .select({ editHistory: mealPlan.editHistory })
      .from(mealPlan)
      .where(and(eq(mealPlan.id, planId), isNull(mealPlan.deletedAt)))
      .limit(1);
    const current = (row?.editHistory ?? []) as MealPlanRevision[];
    const next: MealPlanRevision[] = [
      ...current,
      {
        id: randomUUID(),
        createdAt: new Date().toISOString(),
        action,
        entries: entries.map(mealPlanEntryWriteFromRow),
      },
    ].slice(-20);
    await this._db
      .update(mealPlan)
      .set({ editHistory: next, updatedAt: new Date() })
      .where(and(eq(mealPlan.id, planId), isNull(mealPlan.deletedAt)));
  }

  async undoLastPlanEdit(planId: string): Promise<{
    entries: MealPlanEntry[];
    previous: MealPlanEntry[];
    restored: MealPlanRevision;
  } | null> {
    const [row] = await this._db
      .select({ editHistory: mealPlan.editHistory })
      .from(mealPlan)
      .where(and(eq(mealPlan.id, planId), isNull(mealPlan.deletedAt)))
      .limit(1);
    const history = (row?.editHistory ?? []) as MealPlanRevision[];
    const last = history[history.length - 1];
    if (!last) return null;

    const previous = await this.getMealPlanEntries(planId);
    await this._db
      .update(mealPlan)
      .set({ editHistory: history.slice(0, -1), updatedAt: new Date() })
      .where(and(eq(mealPlan.id, planId), isNull(mealPlan.deletedAt)));
    const entries = await this.replaceMealPlanEntries(planId, last.entries, {
      recordHistory: false,
    });
    return { entries, previous, restored: last };
  }

  async getMealPlanWithEntries(
    id: string
  ): Promise<(MealPlan & { entries: MealPlanEntry[] }) | null> {
    const plan = await this.getMealPlan(id);
    if (!plan) return null;
    const entries = await liveEntriesForPlanRead(
      await this.getMealPlanEntries(id),
      (recipeId) => this.getRecipeTitle(recipeId)
    );
    return { ...plan, entries };
  }

  async createMealPlanEntry(
    data: Omit<MealPlanEntry, "id" | "createdAt" | "updatedAt" | "deletedAt" | "scaleFactor"> & {
      scaleFactor?: number;
    },
    knownRecipeServings?: number | null
  ): Promise<MealPlanEntry> {
    const recipeServings =
      knownRecipeServings !== undefined
        ? knownRecipeServings
        : data.recipeId
          ? await this.getRecipeServings(data.recipeId)
          : null;
    const scaleFactor = scaleFactorForPlanEntry(data.servings, recipeServings, data.scaleFactor);
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
        scaleFactor: String(scaleFactor),
        prepAheadNotes: data.prepAheadNotes ?? null,
        leftoverSourceId: data.leftoverSourceId ?? null,
      })
      .returning();

    if (!created) throw new Error("Failed to create meal plan entry");
    return this.mapMealPlanEntry(created);
  }

  async getRecipeIngredientsForEntry(recipeId: string): Promise<RecipeIngredient[]> {
    const grouped = await this.getRecipeIngredientsForRecipes([recipeId]);
    return grouped.get(recipeId) ?? [];
  }

  async getRecipeIngredientsForRecipes(
    recipeIds: string[]
  ): Promise<Map<string, RecipeIngredient[]>> {
    const grouped = new Map<string, RecipeIngredient[]>();
    if (recipeIds.length === 0) return grouped;

    const ingredients = await this._db
      .select()
      .from(recipeIngredient)
      .where(and(inArray(recipeIngredient.recipeId, recipeIds), isNull(recipeIngredient.deletedAt)))
      .orderBy(recipeIngredient.order);

    for (const ing of ingredients) {
      const parsed = backfillParsedIngredient({
        rawText: ing.rawText,
        quantityMin: ing.quantityMin ? Number(ing.quantityMin) : null,
        quantityMax: ing.quantityMax ? Number(ing.quantityMax) : null,
        unit: ing.unit ?? null,
      });
      const mapped: RecipeIngredient = {
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
      const list = grouped.get(ing.recipeId) ?? [];
      list.push(mapped);
      grouped.set(ing.recipeId, list);
    }
    return grouped;
  }

  async getRecipeTitle(recipeId: string): Promise<string | null> {
    const [result] = await this._db
      .select({ title: recipe.title })
      .from(recipe)
      .where(and(eq(recipe.id, recipeId), isNull(recipe.deletedAt)))
      .limit(1);

    return result?.title ?? null;
  }

  async getRecipeServings(recipeId: string): Promise<number | null> {
    const byId = await this.getRecipeServingsByIds([recipeId]);
    return byId.get(recipeId) ?? null;
  }

  async getRecipeServingsByIds(recipeIds: string[]): Promise<Map<string, number | null>> {
    const byId = new Map<string, number | null>();
    if (recipeIds.length === 0) return byId;
    const rows = await this._db
      .select({ id: recipe.id, servings: recipe.servings })
      .from(recipe)
      .where(and(inArray(recipe.id, recipeIds), isNull(recipe.deletedAt)));
    for (const row of rows) {
      byId.set(row.id, row.servings ?? null);
    }
    return byId;
  }

  async listPlannedDatesForRecipe(householdId: string, recipeId: string): Promise<string[]> {
    const rows = await this._db
      .select({ date: mealPlanEntry.date })
      .from(mealPlanEntry)
      .innerJoin(mealPlan, eq(mealPlan.id, mealPlanEntry.mealPlanId))
      .where(
        and(
          eq(mealPlan.householdId, householdId),
          eq(mealPlanEntry.recipeId, recipeId),
          isNull(mealPlan.deletedAt),
          isNull(mealPlanEntry.deletedAt)
        )
      )
      .orderBy(mealPlanEntry.date);

    return [
      ...new Set(rows.map((row) => row.date).filter((date): date is string => Boolean(date))),
    ];
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
      cookFor: row.cookFor ?? null,
      status: row.status,
      generator: row.generator ?? null,
      generatorModel: row.generatorModel ?? null,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      latestCheckReport: row.latestCheckReport as any,
      checkedAt: row.checkedAt?.toISOString() ?? null,
      contentHash: row.contentHash ?? null,
      acknowledgedWarnings: (row.acknowledgedWarnings as string[]) ?? [],
      needsRecheck: row.needsRecheck ?? false,
      shoppingState: parseShoppingTripState(row.shoppingState),
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
      scaleFactor: row.scaleFactor != null ? Number(row.scaleFactor) : 1,
      prepAheadNotes: row.prepAheadNotes ?? null,
      leftoverSourceId: row.leftoverSourceId ?? null,
    };
  }
}
