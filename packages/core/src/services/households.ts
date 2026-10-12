import { eq, and, isNull } from "drizzle-orm";
import { household, user, membership } from "@ovenlovin/db";
import type { Household, User, Membership } from "../schemas/households";
import { BaseService } from "./base";

export class HouseholdService extends BaseService {
  async getHousehold(id: string): Promise<Household | null> {
    const [result] = await this._db
      .select()
      .from(household)
      .where(and(eq(household.id, id), isNull(household.deletedAt)))
      .limit(1);

    return result ? this.mapHousehold(result) : null;
  }

  async getHouseholdBySlug(slug: string): Promise<Household | null> {
    const [result] = await this._db
      .select()
      .from(household)
      .where(and(eq(household.slug, slug), isNull(household.deletedAt)))
      .limit(1);

    return result ? this.mapHousehold(result) : null;
  }

  async createHousehold(
    data: Omit<Household, "id" | "createdAt" | "updatedAt" | "deletedAt">
  ): Promise<Household> {
    const [created] = await this._db
      .insert(household)
      .values({
        name: data.name,
        slug: data.slug,
        clerkOrgId: data.clerkOrgId ?? null,
        createdBy: data.createdBy,
      })
      .returning();

    if (!created) throw new Error("Failed to create household");
    return this.mapHousehold(created);
  }

  async getUser(id: string): Promise<User | null> {
    const [result] = await this._db
      .select()
      .from(user)
      .where(and(eq(user.id, id), isNull(user.deletedAt)))
      .limit(1);

    return result ? this.mapUser(result) : null;
  }

  async getUserByClerkId(clerkUserId: string): Promise<User | null> {
    const [result] = await this._db
      .select()
      .from(user)
      .where(and(eq(user.clerkUserId, clerkUserId), isNull(user.deletedAt)))
      .limit(1);

    return result ? this.mapUser(result) : null;
  }

  async createUser(
    data: Omit<User, "id" | "createdAt" | "updatedAt" | "deletedAt">
  ): Promise<User> {
    const [created] = await this._db
      .insert(user)
      .values({
        clerkUserId: data.clerkUserId,
        email: data.email,
        displayName: data.displayName ?? null,
      })
      .returning();

    if (!created) throw new Error("Failed to create user");
    return this.mapUser(created);
  }

  async getMemberships(householdId: string): Promise<Membership[]> {
    const results = await this._db
      .select()
      .from(membership)
      .where(and(eq(membership.householdId, householdId), isNull(membership.deletedAt)));

    return results.map((r) => this.mapMembership(r));
  }

  async createMembership(
    data: Omit<Membership, "id" | "createdAt" | "updatedAt" | "deletedAt">
  ): Promise<Membership> {
    const [created] = await this._db
      .insert(membership)
      .values({
        userId: data.userId,
        householdId: data.householdId,
        role: data.role,
      })
      .returning();

    if (!created) throw new Error("Failed to create membership");
    return this.mapMembership(created);
  }

  private mapHousehold(row: typeof household.$inferSelect): Household {
    return {
      id: row.id,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      deletedAt: row.deletedAt?.toISOString() ?? null,
      createdBy: row.createdBy,
      name: row.name,
      slug: row.slug,
      clerkOrgId: row.clerkOrgId ?? null,
    };
  }

  private mapUser(row: typeof user.$inferSelect): User {
    return {
      id: row.id,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      deletedAt: row.deletedAt?.toISOString() ?? null,
      clerkUserId: row.clerkUserId,
      email: row.email,
      displayName: row.displayName ?? null,
    };
  }

  private mapMembership(row: typeof membership.$inferSelect): Membership {
    return {
      id: row.id,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      deletedAt: row.deletedAt?.toISOString() ?? null,
      userId: row.userId,
      householdId: row.householdId,
      role: row.role,
    };
  }
}
