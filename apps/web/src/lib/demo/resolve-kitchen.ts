import { selectActiveMembership, type Membership } from "@ovenlovin/core";
import type { RequestContext } from "@/lib/api/middleware";

export type SandboxIdentity = {
  userId: string;
  clerkUserId: string;
  householdId: string;
};

/**
 * Demo sandboxes pin a visitor to their own kitchen. After they join or select
 * another kitchen, the pin is only a fallback when they are not a member of
 * the preferred kitchen.
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
