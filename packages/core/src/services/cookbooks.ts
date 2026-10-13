import { and, asc, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { collection, collectionRecipe, recipe } from "@ovenlovin/db";
import type { PaginatedResponse, Pagination } from "../schemas/common";
import type { Cookbook, CookbookCard, CookbookSummary } from "../schemas/cookbooks";
import { slugifyCookbookName } from "../schemas/cookbooks";
import { recipeMainImage } from "../media/recipe-images";
import { BaseService } from "./base";

type CookbookRow = typeof collection.$inferSelect;

export class CookbookService extends BaseService {
  async getCookbook(id: string): Promise<Cookbook | null> {
    const [row] = await this._db
      .select()
      .from(collection)
      .where(and(eq(collection.id, id), isNull(collection.deletedAt)))
      .limit(1);
    return row ? this.mapCookbook(row) : null;
  }

  async getCookbookBySlug(householdId: string, slug: string): Promise<Cookbook | null> {
    const [row] = await this._db
      .select()
      .from(collection)
      .where(
        and(
          eq(collection.householdId, householdId),
          eq(collection.slug, slug),
          isNull(collection.deletedAt)
        )
      )
      .limit(1);
    return row ? this.mapCookbook(row) : null;
  }

  async listCookbooks(
    householdId: string,
    pagination?: Pagination
  ): Promise<PaginatedResponse<Cookbook>> {
    const { limit } = this.getPaginationParams(pagination);
    const rows = await this._db
      .select()
      .from(collection)
      .where(and(eq(collection.householdId, householdId), isNull(collection.deletedAt)))
      .orderBy(asc(collection.sortOrder), asc(collection.name), desc(collection.createdAt))
      .limit(limit + 1);

    return this.buildPaginatedResponse(
      rows.map((row) => this.mapCookbook(row)),
      limit
    );
  }

  async listCookbookCards(householdId: string): Promise<CookbookCard[]> {
    const cookbooks = await this.listCookbooks(householdId, { limit: 100 });
    if (cookbooks.items.length === 0) return [];

    const ids = cookbooks.items.map((item) => item.id);
    const memberships = await this._db
      .select({
        cookbookId: collectionRecipe.collectionId,
        recipeId: collectionRecipe.recipeId,
        images: recipe.images,
        createdAt: collectionRecipe.createdAt,
      })
      .from(collectionRecipe)
      .innerJoin(recipe, eq(recipe.id, collectionRecipe.recipeId))
      .where(
        and(
          inArray(collectionRecipe.collectionId, ids),
          isNull(collectionRecipe.deletedAt),
          isNull(recipe.deletedAt)
        )
      )
      .orderBy(asc(collectionRecipe.order), desc(collectionRecipe.createdAt));

    const byCookbook = new Map<string, { count: number; images: string[] }>();
    for (const membership of memberships) {
      const current = byCookbook.get(membership.cookbookId) ?? { count: 0, images: [] };
      current.count += 1;
      const image = recipeMainImage((membership.images as string[] | null) ?? []);
      if (image && current.images.length < 4) current.images.push(image);
      byCookbook.set(membership.cookbookId, current);
    }

    return cookbooks.items.map((item) => {
      const stats = byCookbook.get(item.id) ?? { count: 0, images: [] };
      return {
        ...item,
        recipeCount: stats.count,
        previewImages: stats.images,
      };
    });
  }

  async createCookbook(data: {
    householdId: string;
    name: string;
    description?: string | null;
    createdBy: string;
    visibility?: Cookbook["visibility"];
  }): Promise<Cookbook> {
    let slug = slugifyCookbookName(data.name);
    const existing = await this.getCookbookBySlug(data.householdId, slug);
    if (existing) {
      slug = `${slug}-${Date.now().toString(36).slice(-4)}`;
    }

    const [countRow] = await this._db
      .select({ count: sql<number>`count(*)` })
      .from(collection)
      .where(and(eq(collection.householdId, data.householdId), isNull(collection.deletedAt)));

    const [created] = await this._db
      .insert(collection)
      .values({
        householdId: data.householdId,
        name: data.name.trim(),
        slug,
        description: data.description ?? null,
        visibility: data.visibility ?? "private",
        sortOrder: Number(countRow?.count ?? 0),
        createdBy: data.createdBy,
      })
      .returning();

    if (!created) throw new Error("Failed to create cookbook");
    return this.mapCookbook(created);
  }

  async updateCookbook(
    id: string,
    data: { name?: string; description?: string | null; sortOrder?: number }
  ): Promise<Cookbook | null> {
    const current = await this.getCookbook(id);
    if (!current) return null;

    let slug = current.slug;
    if (data.name && data.name.trim() !== current.name) {
      slug = slugifyCookbookName(data.name);
      const existing = await this.getCookbookBySlug(current.householdId, slug);
      if (existing && existing.id !== id) {
        slug = `${slug}-${Date.now().toString(36).slice(-4)}`;
      }
    }

    const [updated] = await this._db
      .update(collection)
      .set({
        name: data.name?.trim() ?? current.name,
        slug,
        description: data.description === undefined ? current.description : data.description,
        sortOrder: data.sortOrder ?? current.sortOrder,
        updatedAt: new Date(),
      })
      .where(and(eq(collection.id, id), isNull(collection.deletedAt)))
      .returning();

    return updated ? this.mapCookbook(updated) : null;
  }

  async deleteCookbook(id: string): Promise<boolean> {
    const now = new Date();
    const [deleted] = await this._db
      .update(collection)
      .set({ deletedAt: now, updatedAt: now })
      .where(and(eq(collection.id, id), isNull(collection.deletedAt)))
      .returning();

    if (!deleted) return false;

    await this._db
      .update(collectionRecipe)
      .set({ deletedAt: now, updatedAt: now })
      .where(and(eq(collectionRecipe.collectionId, id), isNull(collectionRecipe.deletedAt)));

    return true;
  }

  async listRecipeIds(cookbookId: string): Promise<string[]> {
    const rows = await this._db
      .select({ recipeId: collectionRecipe.recipeId })
      .from(collectionRecipe)
      .where(and(eq(collectionRecipe.collectionId, cookbookId), isNull(collectionRecipe.deletedAt)))
      .orderBy(asc(collectionRecipe.order), desc(collectionRecipe.createdAt));
    return rows.map((row) => row.recipeId);
  }

  async listCookbooksForRecipe(recipeId: string): Promise<CookbookSummary[]> {
    const rows = await this._db
      .select({
        id: collection.id,
        name: collection.name,
        slug: collection.slug,
      })
      .from(collectionRecipe)
      .innerJoin(collection, eq(collection.id, collectionRecipe.collectionId))
      .where(
        and(
          eq(collectionRecipe.recipeId, recipeId),
          isNull(collectionRecipe.deletedAt),
          isNull(collection.deletedAt)
        )
      )
      .orderBy(asc(collection.sortOrder), asc(collection.name));

    return rows;
  }

  async addRecipe(cookbookId: string, recipeId: string): Promise<boolean> {
    const [existing] = await this._db
      .select()
      .from(collectionRecipe)
      .where(
        and(eq(collectionRecipe.collectionId, cookbookId), eq(collectionRecipe.recipeId, recipeId))
      )
      .limit(1);

    if (existing && !existing.deletedAt) return true;

    if (existing) {
      await this._db
        .update(collectionRecipe)
        .set({ deletedAt: null, updatedAt: new Date() })
        .where(eq(collectionRecipe.id, existing.id));
      return true;
    }

    const [countRow] = await this._db
      .select({ count: sql<number>`count(*)` })
      .from(collectionRecipe)
      .where(
        and(eq(collectionRecipe.collectionId, cookbookId), isNull(collectionRecipe.deletedAt))
      );

    await this._db.insert(collectionRecipe).values({
      collectionId: cookbookId,
      recipeId,
      order: Number(countRow?.count ?? 0),
    });
    return true;
  }

  async removeRecipe(cookbookId: string, recipeId: string): Promise<boolean> {
    const [removed] = await this._db
      .update(collectionRecipe)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(
        and(
          eq(collectionRecipe.collectionId, cookbookId),
          eq(collectionRecipe.recipeId, recipeId),
          isNull(collectionRecipe.deletedAt)
        )
      )
      .returning();
    return !!removed;
  }

  async setRecipeCookbooks(recipeId: string, cookbookIds: string[]): Promise<CookbookSummary[]> {
    const uniqueIds = [...new Set(cookbookIds)];
    const current = await this.listCookbooksForRecipe(recipeId);
    const currentIds = new Set(current.map((item) => item.id));

    for (const id of uniqueIds) {
      if (!currentIds.has(id)) {
        await this.addRecipe(id, recipeId);
      }
    }
    for (const existing of current) {
      if (!uniqueIds.includes(existing.id)) {
        await this.removeRecipe(existing.id, recipeId);
      }
    }

    return this.listCookbooksForRecipe(recipeId);
  }

  async listUncategorizedRecipeIds(householdId: string): Promise<string[]> {
    const [recipes, memberships] = await Promise.all([
      this._db
        .select({ id: recipe.id })
        .from(recipe)
        .where(and(eq(recipe.householdId, householdId), isNull(recipe.deletedAt)))
        .orderBy(desc(recipe.createdAt)),
      this._db
        .select({
          recipeId: collectionRecipe.recipeId,
          cookbookId: collection.id,
        })
        .from(collectionRecipe)
        .innerJoin(collection, eq(collection.id, collectionRecipe.collectionId))
        .where(
          and(
            eq(collection.householdId, householdId),
            isNull(collectionRecipe.deletedAt),
            isNull(collection.deletedAt)
          )
        ),
    ]);

    const filed = new Set(memberships.filter((row) => row.cookbookId).map((row) => row.recipeId));
    return recipes.filter((row) => !filed.has(row.id)).map((row) => row.id);
  }

  private mapCookbook(row: CookbookRow): Cookbook {
    return {
      id: row.id,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      deletedAt: row.deletedAt?.toISOString() ?? null,
      createdBy: row.createdBy,
      householdId: row.householdId,
      name: row.name,
      slug: row.slug,
      description: row.description ?? null,
      visibility: row.visibility,
      sortOrder: row.sortOrder ?? 0,
    };
  }
}
