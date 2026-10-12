import { eq, and, isNull, desc, like, sql } from "drizzle-orm";
import { recipe } from "@ovenlovin/db";
import type { Recipe } from "../schemas/recipes";
import type { PaginatedResponse, Pagination } from "../schemas/common";
import { BaseService } from "./base";

export class RecipeService extends BaseService {
  async getRecipe(id: string): Promise<Recipe | null> {
    const [result] = await this._db
      .select()
      .from(recipe)
      .where(and(eq(recipe.id, id), isNull(recipe.deletedAt)))
      .limit(1);

    return result ? this.mapRecipe(result) : null;
  }

  async getRecipeBySlug(householdId: string, slug: string): Promise<Recipe | null> {
    const [result] = await this._db
      .select()
      .from(recipe)
      .where(
        and(eq(recipe.householdId, householdId), eq(recipe.slug, slug), isNull(recipe.deletedAt))
      )
      .limit(1);

    return result ? this.mapRecipe(result) : null;
  }

  async listRecipes(
    householdId: string,
    options?: {
      status?: string;
      search?: string;
      pagination?: Pagination;
    }
  ): Promise<PaginatedResponse<Recipe>> {
    const { limit } = this.getPaginationParams(options?.pagination);

    let conditions = [eq(recipe.householdId, householdId), isNull(recipe.deletedAt)];

    if (options?.status) {
      conditions.push(eq(recipe.status, options.status as any));
    }

    if (options?.search) {
      conditions.push(like(recipe.title, `%${options.search}%`));
    }

    const results = await this._db
      .select()
      .from(recipe)
      .where(and(...conditions))
      .orderBy(desc(recipe.createdAt))
      .limit(limit + 1);

    const recipes = results.map((r) => this.mapRecipe(r));

    return this.buildPaginatedResponse(recipes, limit);
  }

  async createRecipe(
    data: Omit<Recipe, "id" | "createdAt" | "updatedAt" | "deletedAt">
  ): Promise<Recipe> {
    const [created] = await this._db
      .insert(recipe)
      .values({
        householdId: data.householdId,
        title: data.title,
        slug: data.slug,
        description: data.description ?? null,
        yieldQuantity: data.yieldQuantity ? String(data.yieldQuantity) : null,
        yieldUnit: data.yieldUnit ?? null,
        servings: data.servings ?? null,
        prepTimeMinutes: data.prepTimeMinutes ?? null,
        cookTimeMinutes: data.cookTimeMinutes ?? null,
        totalTimeMinutes: data.totalTimeMinutes ?? null,
        activeTimeMinutes: data.activeTimeMinutes ?? null,
        methodTags: data.methodTags ?? [],
        cuisine: data.cuisine ?? null,
        course: data.course ?? null,
        difficulty: data.difficulty ?? null,
        equipment: data.equipment ?? [],
        images: data.images ?? [],
        status: data.status ?? "draft",
        visibility: data.visibility ?? "private",
        version: data.version ?? 1,
        parentRecipeId: data.parentRecipeId ?? null,
        isFamilyRecipe: data.isFamilyRecipe ?? false,
        familyStory: data.familyStory ?? null,
        createdBy: data.createdBy,
      })
      .returning();

    if (!created) throw new Error("Failed to create recipe");
    return this.mapRecipe(created);
  }

  async updateRecipe(
    id: string,
    data: Partial<Omit<Recipe, "id" | "createdAt" | "updatedAt" | "deletedAt" | "createdBy">>
  ): Promise<Recipe | null> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updateData: any = { ...data, updatedAt: new Date() };
    if (data.yieldQuantity !== undefined) {
      updateData.yieldQuantity = data.yieldQuantity ? String(data.yieldQuantity) : null;
    }

    const [updated] = await this._db
      .update(recipe)
      .set(updateData)
      .where(and(eq(recipe.id, id), isNull(recipe.deletedAt)))
      .returning();

    return updated ? this.mapRecipe(updated) : null;
  }

  async deleteRecipe(id: string): Promise<boolean> {
    const [deleted] = await this._db
      .update(recipe)
      .set({ deletedAt: new Date() })
      .where(and(eq(recipe.id, id), isNull(recipe.deletedAt)))
      .returning();

    return !!deleted;
  }

  async countRecipesByHousehold(householdId: string): Promise<number> {
    const [result] = await this._db
      .select({ count: sql<number>`count(*)` })
      .from(recipe)
      .where(and(eq(recipe.householdId, householdId), isNull(recipe.deletedAt)));

    return result?.count ?? 0;
  }

  private mapRecipe(row: typeof recipe.$inferSelect): Recipe {
    return {
      id: row.id,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      deletedAt: row.deletedAt?.toISOString() ?? null,
      createdBy: row.createdBy,
      householdId: row.householdId,
      title: row.title,
      slug: row.slug,
      description: row.description ?? null,
      yieldQuantity: row.yieldQuantity ? Number(row.yieldQuantity) : null,
      yieldUnit: row.yieldUnit ?? null,
      servings: row.servings ?? null,
      prepTimeMinutes: row.prepTimeMinutes ?? null,
      cookTimeMinutes: row.cookTimeMinutes ?? null,
      totalTimeMinutes: row.totalTimeMinutes ?? null,
      activeTimeMinutes: row.activeTimeMinutes ?? null,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      methodTags: (row.methodTags as any) ?? [],
      cuisine: row.cuisine ?? null,
      course: row.course ?? null,
      difficulty: row.difficulty ?? null,
      equipment: (row.equipment as string[]) ?? [],
      images: (row.images as string[]) ?? [],
      status: row.status,
      visibility: row.visibility,
      version: row.version,
      parentRecipeId: row.parentRecipeId ?? null,
      isFamilyRecipe: row.isFamilyRecipe ?? false,
      familyStory: row.familyStory ?? null,
    };
  }
}
