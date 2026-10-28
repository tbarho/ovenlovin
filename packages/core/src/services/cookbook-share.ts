import { randomBytes } from "crypto";
import { and, eq, isNotNull, isNull } from "drizzle-orm";
import { collectionRecipe, recipe, recipeSource, share } from "@ovenlovin/db";
import { BaseService } from "./base";

export const SHARE_BLOCKED_REASON =
  "Has recipes from a published cookbook, so it stays in your kitchen.";

export class ShareBlockedError extends Error {
  readonly code = "share_blocked";

  constructor() {
    super(SHARE_BLOCKED_REASON);
    this.name = "ShareBlockedError";
  }
}

export type CookbookShareStatus = { token: string | null; blocked: string | null };

const activeLink = (cookbookId: string) =>
  and(
    eq(share.resourceType, "collection"),
    eq(share.resourceId, cookbookId),
    eq(share.granteeType, "public"),
    isNull(share.deletedAt)
  );

/** Unlisted, view-only reader links for a cookbook. One live link per cookbook. */
export class CookbookShareService extends BaseService {
  /** True when any recipe in the cookbook came from a published book (PDF or paper). */
  async hasPublishedBookRecipes(cookbookId: string): Promise<boolean> {
    const rows = await this._db
      .select({ id: recipe.id })
      .from(collectionRecipe)
      .innerJoin(recipe, eq(recipe.id, collectionRecipe.recipeId))
      .innerJoin(recipeSource, eq(recipeSource.recipeId, recipe.id))
      .where(
        and(
          eq(collectionRecipe.collectionId, cookbookId),
          isNull(collectionRecipe.deletedAt),
          isNull(recipe.deletedAt),
          isNull(recipeSource.deletedAt),
          isNotNull(recipeSource.bookTitle)
        )
      )
      .limit(1);
    return rows.length > 0;
  }

  async getStatus(cookbookId: string): Promise<CookbookShareStatus> {
    if (await this.hasPublishedBookRecipes(cookbookId)) {
      return { token: null, blocked: SHARE_BLOCKED_REASON };
    }
    const [row] = await this._db.select().from(share).where(activeLink(cookbookId)).limit(1);
    return { token: row?.token ?? null, blocked: null };
  }

  /** The live link, made on first ask. Throws when the cookbook holds published-book recipes. */
  async createLink(cookbookId: string, createdBy: string): Promise<CookbookShareStatus> {
    const status = await this.getStatus(cookbookId);
    if (status.blocked) throw new ShareBlockedError();
    if (status.token) return status;
    const [created] = await this._db
      .insert(share)
      .values({
        resourceType: "collection",
        resourceId: cookbookId,
        granteeType: "public",
        permission: "view",
        token: `olbook_${randomBytes(32).toString("base64url")}`,
        createdBy,
      })
      .returning();
    if (!created?.token) throw new Error("Failed to create share link");
    return { token: created.token, blocked: null };
  }

  async revokeLink(cookbookId: string): Promise<void> {
    await this._db
      .update(share)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(activeLink(cookbookId));
  }

  /** Cookbook id behind a live link, or null when revoked, unknown, or now blocked. */
  async resolveLink(token: string): Promise<string | null> {
    if (!token.startsWith("olbook_")) return null;
    const [row] = await this._db
      .select({ cookbookId: share.resourceId })
      .from(share)
      .where(
        and(
          eq(share.token, token),
          eq(share.resourceType, "collection"),
          eq(share.granteeType, "public"),
          isNull(share.deletedAt)
        )
      )
      .limit(1);
    if (!row) return null;
    if (await this.hasPublishedBookRecipes(row.cookbookId)) return null;
    return row.cookbookId;
  }
}
