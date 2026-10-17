import { randomBytes } from "crypto";
import { and, eq, isNull } from "drizzle-orm";
import { household, householdInvite } from "@ovenlovin/db";
import type {
  CreateInviteInput,
  HouseholdInvite,
  HouseholdInvitePreview,
  InviteRole,
  Membership,
  MembershipRole,
} from "../schemas/households";
import { BaseService } from "./base";
import { HouseholdService } from "./households";
import {
  HouseholdAccessError,
  assertCanManageInvites,
  assertInviteAcceptable,
  assertInviteableRole,
  defaultInviteExpiry,
  inviteStatus,
} from "./kitchen-access";

export class InviteService extends BaseService {
  async createInvite(
    householdId: string,
    input: Partial<CreateInviteInput>,
    actor: { userId: string; role: MembershipRole }
  ): Promise<HouseholdInvite> {
    assertCanManageInvites(actor.role);
    const role = input.role ?? "member";
    assertInviteableRole(role);

    const [householdRow] = await this._db
      .select()
      .from(household)
      .where(and(eq(household.id, householdId), isNull(household.deletedAt)))
      .limit(1);
    if (!householdRow) {
      throw new HouseholdAccessError("Kitchen not found.", "not_found");
    }

    const expiresAt = defaultInviteExpiry(new Date(), input.expiresInDays ?? 7);
    const token = this.generateToken();
    const [created] = await this._db
      .insert(householdInvite)
      .values({
        householdId,
        token,
        role,
        expiresAt,
        createdBy: actor.userId,
      })
      .returning();
    if (!created) throw new Error("Failed to create kitchen invite");
    return this.mapInvite(created);
  }

  async listPendingInvites(
    householdId: string,
    actorRole: MembershipRole,
    now = new Date()
  ): Promise<HouseholdInvite[]> {
    assertCanManageInvites(actorRole);
    const rows = await this._db
      .select()
      .from(householdInvite)
      .where(and(eq(householdInvite.householdId, householdId), isNull(householdInvite.deletedAt)));

    return rows
      .map((row) => this.mapInvite(row))
      .filter((invite) => inviteStatus({ ...invite, now }) === "pending")
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0));
  }

  async revokeInvite(
    inviteId: string,
    householdId: string,
    actorRole: MembershipRole
  ): Promise<HouseholdInvite> {
    assertCanManageInvites(actorRole);
    const [existing] = await this._db
      .select()
      .from(householdInvite)
      .where(
        and(
          eq(householdInvite.id, inviteId),
          eq(householdInvite.householdId, householdId),
          isNull(householdInvite.deletedAt)
        )
      )
      .limit(1);
    if (!existing) {
      throw new HouseholdAccessError("Invite not found.", "not_found");
    }
    if (existing.revokedAt) {
      return this.mapInvite(existing);
    }
    const [updated] = await this._db
      .update(householdInvite)
      .set({ revokedAt: new Date(), updatedAt: new Date() })
      .where(eq(householdInvite.id, inviteId))
      .returning();
    if (!updated) {
      throw new HouseholdAccessError("Invite not found.", "not_found");
    }
    return this.mapInvite(updated);
  }

  async getInviteByToken(token: string): Promise<HouseholdInvite | null> {
    const [row] = await this._db
      .select()
      .from(householdInvite)
      .where(and(eq(householdInvite.token, token), isNull(householdInvite.deletedAt)))
      .limit(1);
    return row ? this.mapInvite(row) : null;
  }

  async previewInvite(token: string, now = new Date()): Promise<HouseholdInvitePreview | null> {
    const invite = await this.getInviteByToken(token);
    if (!invite) return null;
    const [householdRow] = await this._db
      .select()
      .from(household)
      .where(and(eq(household.id, invite.householdId), isNull(household.deletedAt)))
      .limit(1);
    if (!householdRow) return null;
    return {
      householdId: invite.householdId,
      householdName: householdRow.name,
      role: invite.role,
      expiresAt: invite.expiresAt,
      status: inviteStatus({ ...invite, now }),
    };
  }

  async acceptInvite(
    token: string,
    userId: string,
    now = new Date()
  ): Promise<{
    membership: Membership;
    alreadyMember: boolean;
    householdId: string;
    role: InviteRole;
  }> {
    const invite = await this.getInviteByToken(token);
    if (!invite) {
      throw new HouseholdAccessError("Invite not found.", "not_found");
    }
    assertInviteAcceptable({ ...invite, now });

    const households = new HouseholdService(this._db);
    const kitchen = await households.getHousehold(invite.householdId);
    if (!kitchen) {
      throw new HouseholdAccessError("Kitchen not found.", "not_found");
    }

    const memberships = await households.getMembershipsForUser(userId);
    const existing = memberships.find((item) => item.householdId === invite.householdId);
    if (existing) {
      return {
        membership: existing,
        alreadyMember: true,
        householdId: invite.householdId,
        role: invite.role,
      };
    }

    const membership = await households.createMembership({
      userId,
      householdId: invite.householdId,
      role: invite.role,
    });
    return {
      membership,
      alreadyMember: false,
      householdId: invite.householdId,
      role: invite.role,
    };
  }

  private generateToken(): string {
    return `olinv_${randomBytes(24).toString("hex")}`;
  }

  private mapInvite(row: typeof householdInvite.$inferSelect): HouseholdInvite {
    if (row.role === "owner") {
      throw new HouseholdAccessError(
        "Invite role must be admin, member, or viewer. Owner cannot be granted by invite.",
        "invalid"
      );
    }
    return {
      id: row.id,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      deletedAt: row.deletedAt?.toISOString() ?? null,
      createdBy: row.createdBy,
      householdId: row.householdId,
      token: row.token,
      role: row.role,
      expiresAt: row.expiresAt.toISOString(),
      revokedAt: row.revokedAt?.toISOString() ?? null,
    };
  }
}
