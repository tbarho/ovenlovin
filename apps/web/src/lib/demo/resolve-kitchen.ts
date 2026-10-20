import { selectActiveMembership, type Membership } from "@ovenlovin/core";
import type { RequestContext } from "@/lib/api/middleware";

export type SandboxIdentity = {
  userId: string;
  clerkUserId: string;
  householdId: string;
};

/**
 * Demo sandboxes pin a visitor to their own kitchen only when they have no
 * memberships yet. After they join another kitchen, newest membership wins
 * unless a preferred kitchen cookie matches.
 */
export function resolveSandboxSession(input: {
  sandbox: SandboxIdentity;
  memberships: Membership[];
  preferredHouseholdId?: string | null;
}): RequestContext {
  const selected = selectActiveMembership(input.memberships, input.preferredHouseholdId);
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
