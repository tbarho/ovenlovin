import { selectActiveMembership, type Membership } from "@ovenlovin/core";
import type { RequestContext } from "@/lib/api/middleware";

export type SandboxIdentity = {
  userId: string;
  clerkUserId: string;
  householdId: string;
};

/**
 * Demo sandboxes pin a visitor to their own kitchen. A preferred cookie or
 * pending invite wins. With no cookie, land on the kitchen they joined
 * (newest). MCP/REST/leave still use oldest via selectActiveMembership.
 */
export function resolveSandboxSession(input: {
  sandbox: SandboxIdentity;
  memberships: Membership[];
  preferredHouseholdId?: string | null;
}): RequestContext {
  const newest = [...input.memberships].sort((a, b) => {
    const created = b.createdAt.localeCompare(a.createdAt);
    if (created !== 0) return created;
    return b.id.localeCompare(a.id);
  })[0];
  const selected = selectActiveMembership(
    input.memberships,
    input.preferredHouseholdId ?? newest?.householdId
  );
  if (selected) {
    return {
      userId: input.sandbox.userId,
      clerkUserId: input.sandbox.clerkUserId,
      householdId: selected.householdId,
      membershipRole: selected.role,
    };
  }
  return {
    userId: input.sandbox.userId,
    clerkUserId: input.sandbox.clerkUserId,
    householdId: input.sandbox.householdId,
    membershipRole: "owner",
  };
}
