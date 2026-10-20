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

export const INVITE_TOKEN_PATTERN = /^olinv_[a-f0-9]{32,128}$/;

export function isInviteToken(token: string): boolean {
  return INVITE_TOKEN_PATTERN.test(token);
}

export function invitePath(token: string): string {
  return `/invite/${token}`;
}

export function inviteAcceptLink(origin: string, token: string): string {
  return `${origin.replace(/\/$/, "")}${invitePath(token)}`;
}

export function inviteNeedsSignedInUserMessage(
  origin: string,
  token: string,
  viaApiKey: boolean
): string {
  const link = inviteAcceptLink(origin, token);
  if (viaApiKey) {
    return `An API key cannot accept a kitchen invite or join another kitchen. A signed-in person must open ${link}.`;
  }
  return `User authentication required. A signed-in person must open ${link}.`;
}

export const API_KEY_CANNOT_SWITCH_KITCHEN_MESSAGE =
  "An API key is bound to one kitchen and cannot switch. A signed-in person can switch kitchens. Use GET /api/v1/households/mine to see this key's kitchen.";

export const API_KEY_KITCHEN_HEADER_MISMATCH =
  "An API key is bound to one kitchen. X-Kitchen-Id must match that kitchen or be omitted.";

export function apiKeyKitchenHeaderMismatch(
  keyHouseholdId: string,
  kitchenIdHeader?: string | null
): boolean {
  return Boolean(kitchenIdHeader && kitchenIdHeader !== keyHouseholdId);
}

export function canManageInvites(role: MembershipRole | undefined): boolean {
  return role === "owner" || role === "admin";
}

export function canManageMembers(role: MembershipRole | undefined): boolean {
  return role === "owner";
}

export function canRenameKitchen(role: MembershipRole | undefined): boolean {
  return role === "owner";
}

export function canWriteKitchen(role: MembershipRole | undefined): boolean {
  return role === "owner" || role === "admin" || role === "member";
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

export function assertCanRenameKitchen(role: MembershipRole | undefined): void {
  if (!canRenameKitchen(role)) {
    throw new HouseholdAccessError("Owner role is required to rename this kitchen.", "forbidden");
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

/** A pending invite kitchen wins so accept lands there; otherwise the last selected kitchen. */
export function preferredKitchenId(input: {
  selectedHouseholdId?: string | null;
  pendingInviteHouseholdId?: string | null;
}): string | null {
  return input.pendingInviteHouseholdId ?? input.selectedHouseholdId ?? null;
}

/** Creator's current role in the key's kitchen - not a role from another household. */
export function apiKeyMembershipRole(
  memberships: Array<{ householdId: string; role: MembershipRole }>,
  householdId: string
): MembershipRole | undefined {
  return memberships.find((item) => item.householdId === householdId)?.role;
}

export const API_KEY_CREATOR_NOT_A_MEMBER =
  "This API key's creator is no longer a member of this kitchen.";

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
