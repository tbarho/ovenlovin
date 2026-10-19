import { eq, and, isNull } from "drizzle-orm";
import { household, user, membership } from "@ovenlovin/db";
import type {
  Household,
  HouseholdMember,
  HouseholdServingsSettings,
  InviteRole,
  Membership,
  MembershipRole,
  User,
  UserHousehold,
} from "../schemas/households";
import {
  updateHouseholdNameSchema,
  updateHouseholdServingsSettingsSchema,
} from "../schemas/households";
import {
  normalizeHouseholdServingsSetting,
  parseDefaultServingsMode,
  weekDefaultServings,
} from "../scaling/default-servings";
import { BaseService } from "./base";
import {
  HouseholdAccessError,
  assertCanManageMembers,
  assertCanRenameKitchen,
  isSoleOwner,
  selectActiveMembership,
} from "./kitchen-access";

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
    data: Omit<
      Household,
      | "id"
      | "createdAt"
      | "updatedAt"
      | "deletedAt"
      | "defaultServingsMode"
      | "defaultServingsCount"
    > & {
      defaultServingsMode?: Household["defaultServingsMode"];
      defaultServingsCount?: number | null;
    }
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

  async updateHouseholdName(input: {
    householdId: string;
    name: string;
    actorRole?: MembershipRole;
  }): Promise<Household> {
    assertCanRenameKitchen(input.actorRole);
    const { name } = updateHouseholdNameSchema.parse({ name: input.name });
    const now = new Date();
    const [updated] = await this._db
      .update(household)
      .set({
        name,
        updatedAt: now,
      })
      .where(and(eq(household.id, input.householdId), isNull(household.deletedAt)))
      .returning();
    if (!updated) throw new Error("Household not found");
    return this.mapHousehold(updated);
  }

  async updateServingsSettings(
    householdId: string,
    patch: { mode: "family" | "fixed" | "recipe"; servings?: number | null }
  ): Promise<Household> {
    const parsed = updateHouseholdServingsSettingsSchema.parse(patch);
    const setting = normalizeHouseholdServingsSetting(parsed);
    const now = new Date();
    const [updated] = await this._db
      .update(household)
      .set({
        defaultServingsMode: setting.mode,
        defaultServingsCount: setting.servings,
        updatedAt: now,
      })
      .where(and(eq(household.id, householdId), isNull(household.deletedAt)))
      .returning();
    if (!updated) throw new Error("Household not found");
    return this.mapHousehold(updated);
  }

  servingsSettingsFor(household: Household, familySize: number): HouseholdServingsSettings {
    const setting = normalizeHouseholdServingsSetting({
      mode: household.defaultServingsMode,
      servings: household.defaultServingsCount ?? null,
    });
    return {
      mode: setting.mode,
      servings: setting.servings,
      familySize,
      defaultCookFor: weekDefaultServings({
        familySize,
        mode: setting.mode,
        fixedServings: setting.servings,
      }),
    };
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

  async getHouseholdByClerkOrgId(clerkOrgId: string): Promise<Household | null> {
    const [result] = await this._db
      .select()
      .from(household)
      .where(and(eq(household.clerkOrgId, clerkOrgId), isNull(household.deletedAt)))
      .limit(1);

    return result ? this.mapHousehold(result) : null;
  }

  async getMemberships(householdId: string): Promise<Membership[]> {
    const results = await this._db
      .select()
      .from(membership)
      .where(and(eq(membership.householdId, householdId), isNull(membership.deletedAt)));

    return results.map((r) => this.mapMembership(r));
  }

  async getMembershipsForUser(userId: string): Promise<Membership[]> {
    const results = await this._db
      .select()
      .from(membership)
      .where(and(eq(membership.userId, userId), isNull(membership.deletedAt)));

    return results.map((r) => this.mapMembership(r));
  }

  async ensureHouseholdForClerkUser(input: {
    clerkUserId: string;
    email: string;
    displayName?: string | null;
    clerkOrgId?: string | null;
    pendingInvite?: { householdId: string; role: InviteRole } | null;
    preferredHouseholdId?: string | null;
  }): Promise<{ user: User; household: Household; membership: Membership; created: boolean }> {
    const existingUser = await this.getUserByClerkId(input.clerkUserId);
    const userRecord =
      existingUser ??
      (await this.createUser({
        clerkUserId: input.clerkUserId,
        email: input.email,
        displayName: input.displayName ?? null,
      }));

    if (input.clerkOrgId) {
      const orgHousehold = await this.getHouseholdByClerkOrgId(input.clerkOrgId);
      if (orgHousehold) {
        const orgMemberships = await this.getMembershipsForUser(userRecord.id);
        const existing = orgMemberships.find((item) => item.householdId === orgHousehold.id);
        if (!existing) {
          await this.createMembership({
            userId: userRecord.id,
            householdId: orgHousehold.id,
            role: "member",
          });
        }
      }
    }

    if (input.pendingInvite) {
      const invited = await this.getHousehold(input.pendingInvite.householdId);
      if (invited) {
        const memberships = await this.getMembershipsForUser(userRecord.id);
        const existing = memberships.find((item) => item.householdId === invited.id);
        const member =
          existing ??
          (await this.createMembership({
            userId: userRecord.id,
            householdId: invited.id,
            role: input.pendingInvite.role,
          }));
        return { user: userRecord, household: invited, membership: member, created: !existing };
      }
    }

    const memberships = await this.getMembershipsForUser(userRecord.id);
    const selected = selectActiveMembership(memberships, input.preferredHouseholdId);
    if (selected) {
      const householdRecord = await this.getHousehold(selected.householdId);
      if (householdRecord) {
        return {
          user: userRecord,
          household: householdRecord,
          membership: selected,
          created: false,
        };
      }
    }

    const name = `${input.displayName?.trim() || "Your"} Kitchen`;
    const slug = `kitchen-${userRecord.id.replace(/-/g, "").slice(0, 16)}`;
    const createdHousehold = await this.createHousehold({
      name,
      slug,
      clerkOrgId: input.clerkOrgId ?? null,
      createdBy: userRecord.id,
    });
    const createdMembership = await this.createMembership({
      userId: userRecord.id,
      householdId: createdHousehold.id,
      role: "owner",
    });

    return {
      user: userRecord,
      household: createdHousehold,
      membership: createdMembership,
      created: true,
    };
  }

  async listMembers(householdId: string): Promise<HouseholdMember[]> {
    const rows = await this._db
      .select({
        membershipId: membership.id,
        userId: user.id,
        email: user.email,
        displayName: user.displayName,
        role: membership.role,
        createdAt: membership.createdAt,
      })
      .from(membership)
      .innerJoin(user, eq(membership.userId, user.id))
      .where(
        and(
          eq(membership.householdId, householdId),
          isNull(membership.deletedAt),
          isNull(user.deletedAt)
        )
      );

    return rows
      .map((row) => ({
        membershipId: row.membershipId,
        userId: row.userId,
        email: row.email,
        displayName: row.displayName ?? null,
        role: row.role,
        createdAt: row.createdAt.toISOString(),
      }))
      .sort((a, b) => {
        const created = a.createdAt.localeCompare(b.createdAt);
        if (created !== 0) return created;
        return a.userId.localeCompare(b.userId);
      });
  }

  async listHouseholdsForUser(userId: string): Promise<UserHousehold[]> {
    const memberships = await this.getMembershipsForUser(userId);
    const result: UserHousehold[] = [];
    for (const member of memberships) {
      const householdRecord = await this.getHousehold(member.householdId);
      if (householdRecord) {
        result.push({ household: householdRecord, membership: member });
      }
    }
    return result.sort((a, b) => {
      const created = a.membership.createdAt.localeCompare(b.membership.createdAt);
      if (created !== 0) return created;
      return a.household.id.localeCompare(b.household.id);
    });
  }

  async updateMemberRole(input: {
    householdId: string;
    targetUserId: string;
    role: MembershipRole;
    actorUserId: string;
    actorRole: MembershipRole;
  }): Promise<Membership> {
    assertCanManageMembers(input.actorRole);
    const members = await this.getMemberships(input.householdId);
    const target = members.find((item) => item.userId === input.targetUserId);
    if (!target) {
      throw new HouseholdAccessError("Kitchen member not found.", "not_found");
    }
    if (target.role === "owner" && input.role !== "owner" && isSoleOwner(members, target.userId)) {
      throw new HouseholdAccessError(
        "The last owner cannot be demoted. Promote someone else first.",
        "conflict"
      );
    }
    const [updated] = await this._db
      .update(membership)
      .set({ role: input.role, updatedAt: new Date() })
      .where(and(eq(membership.id, target.id), isNull(membership.deletedAt)))
      .returning();
    if (!updated) {
      throw new HouseholdAccessError("Kitchen member not found.", "not_found");
    }
    return this.mapMembership(updated);
  }

  async removeMember(input: {
    householdId: string;
    targetUserId: string;
    actorUserId: string;
    actorRole: MembershipRole;
  }): Promise<void> {
    if (input.targetUserId === input.actorUserId) {
      throw new HouseholdAccessError("Use leave to remove yourself from a kitchen.", "invalid");
    }
    assertCanManageMembers(input.actorRole);
    const members = await this.getMemberships(input.householdId);
    const target = members.find((item) => item.userId === input.targetUserId);
    if (!target) {
      throw new HouseholdAccessError("Kitchen member not found.", "not_found");
    }
    if (isSoleOwner(members, target.userId)) {
      throw new HouseholdAccessError("The last owner cannot be removed.", "conflict");
    }
    await this.softDeleteMembership(target.id);
  }

  async leaveHousehold(input: { householdId: string; userId: string }): Promise<void> {
    const members = await this.getMemberships(input.householdId);
    const target = members.find((item) => item.userId === input.userId);
    if (!target) {
      throw new HouseholdAccessError("You are not a member of this kitchen.", "not_found");
    }
    if (isSoleOwner(members, input.userId)) {
      throw new HouseholdAccessError(
        "The last owner cannot leave. Promote someone else first.",
        "conflict"
      );
    }
    await this.softDeleteMembership(target.id);
  }

  async softDeleteMembership(membershipId: string): Promise<void> {
    const now = new Date();
    await this._db
      .update(membership)
      .set({ deletedAt: now, updatedAt: now })
      .where(and(eq(membership.id, membershipId), isNull(membership.deletedAt)));
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
      defaultServingsMode: parseDefaultServingsMode(row.defaultServingsMode),
      defaultServingsCount: row.defaultServingsCount ?? null,
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
