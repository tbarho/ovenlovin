import type { InviteRole, InviteStatus, Membership, MembershipRole } from "../schemas/households";

export type HouseholdAccessErrorCode =
  "forbidden" | "not_found" | "conflict" | "expired" | "invalid";

export class HouseholdAccessError extends Error {
  readonly code: HouseholdAccessErrorCode;

  constructor(message: string, code: HouseholdAccessErrorCode) {
    super(message);
    this.name = "HouseholdAccessError";
    this.code = code;
  }
}

export const INVITEABLE_ROLES: readonly InviteRole[] = ["admin", "member", "viewer"];

export function canManageInvites(role: MembershipRole | undefined): boolean {
  return role === "owner" || role === "admin";
}

export function canManageMembers(role: MembershipRole | undefined): boolean {
  return role === "owner";
}

export function assertCanManageInvites(role: MembershipRole | undefined): void {
  if (!canManageInvites(role)) {
    throw new HouseholdAccessError(
      "Owner or admin role is required to manage kitchen invites.",
      "forbidden"
    );
  }
}

export function assertCanManageMembers(role: MembershipRole | undefined): void {
  if (!canManageMembers(role)) {
    throw new HouseholdAccessError(
      "Owner role is required to change kitchen members or roles.",
      "forbidden"
    );
  }
}

export function assertInviteableRole(role: string): asserts role is InviteRole {
  if (!INVITEABLE_ROLES.includes(role as InviteRole)) {
    throw new HouseholdAccessError(
      "Invite role must be admin, member, or viewer. Owner cannot be granted by invite.",
      "invalid"
    );
  }
}

export function ownersIn(memberships: Array<{ role: MembershipRole; userId: string }>) {
  return memberships.filter((item) => item.role === "owner");
}

export function isSoleOwner(
  memberships: Array<{ role: MembershipRole; userId: string }>,
  userId: string
): boolean {
  const owners = ownersIn(memberships);
  return owners.length === 1 && owners[0]?.userId === userId;
}

export function selectActiveMembership(
  memberships: Membership[],
  preferredHouseholdId?: string | null
): Membership | null {
  if (memberships.length === 0) return null;
  if (preferredHouseholdId) {
    const preferred = memberships.find((item) => item.householdId === preferredHouseholdId);
    if (preferred) return preferred;
  }
  const sorted = [...memberships].sort((a, b) => {
    const created = a.createdAt.localeCompare(b.createdAt);
    if (created !== 0) return created;
    return a.id.localeCompare(b.id);
  });
  return sorted[0] ?? null;
}

export function inviteStatus(input: {
  expiresAt: string;
  revokedAt?: string | null;
  now?: Date;
}): InviteStatus {
  if (input.revokedAt) return "revoked";
  const now = input.now ?? new Date();
  if (new Date(input.expiresAt).getTime() <= now.getTime()) return "expired";
  return "pending";
}

export function assertInviteAcceptable(input: {
  expiresAt: string;
  revokedAt?: string | null;
  now?: Date;
}): void {
  const status = inviteStatus(input);
  if (status === "revoked") {
    throw new HouseholdAccessError("This invite link was revoked.", "expired");
  }
  if (status === "expired") {
    throw new HouseholdAccessError("This invite link has expired.", "expired");
  }
}

export function defaultInviteExpiry(now = new Date(), expiresInDays = 7): Date {
  const days = Number.isFinite(expiresInDays) ? Math.trunc(expiresInDays) : 7;
  const clamped = Math.min(30, Math.max(1, days));
  return new Date(now.getTime() + clamped * 24 * 60 * 60 * 1000);
}
