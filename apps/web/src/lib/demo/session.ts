import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { HouseholdService, InviteService, inviteStatus, preferredKitchenId } from "@ovenlovin/core";
import { getDatabase } from "@ovenlovin/db";
import { UnauthorizedError } from "@/lib/api/errors";
import type { RequestContext } from "@/lib/api/middleware";
import { readKitchenCookies } from "@/lib/kitchen-selection";
import { DEMO_ENTER_PATH, safeDemoEnterNext } from "./enter";
import { DEMO_COOKIE_NAME } from "./fixture";
import { resolveSandboxSession } from "./resolve-kitchen";
import { findDemoSandboxById, type DemoSandboxRecord } from "./sandbox";

export async function getDemoSessionContext(options?: {
  allowRedirect?: boolean;
}): Promise<RequestContext> {
  const store = await cookies();
  const cookieId = store.get(DEMO_COOKIE_NAME)?.value;
  const sandbox = cookieId ? await findDemoSandboxById(cookieId) : null;
  if (!sandbox) {
    if (options?.allowRedirect === false) {
      throw new UnauthorizedError("Authentication required");
    }
    redirect(`${DEMO_ENTER_PATH}?next=${encodeURIComponent(safeDemoEnterNext("/recipes"))}`);
  }

  const db = getDatabase();
  const households = new HouseholdService(db);
  const invites = new InviteService(db);
  const { preferredHouseholdId, inviteToken } = readKitchenCookies(store);
  let pendingInviteHouseholdId: string | null = null;
  if (inviteToken) {
    const invite = await invites.getInviteByToken(inviteToken);
    if (invite && inviteStatus(invite) === "pending") {
      const invited = await households.getHousehold(invite.householdId);
      if (invited) {
        pendingInviteHouseholdId = invite.householdId;
        await invites.acceptInvite(invite.token, sandbox.userId);
      }
    }
  }

  const memberships = await households.getMembershipsForUser(sandbox.userId);
  return resolveSandboxSession({
    sandbox,
    memberships,
    preferredHouseholdId: preferredKitchenId({
      selectedHouseholdId: preferredHouseholdId,
      pendingInviteHouseholdId,
    }),
  });
}

export async function getDemoSandboxForSession(): Promise<DemoSandboxRecord | null> {
  const store = await cookies();
  const cookieId = store.get(DEMO_COOKIE_NAME)?.value;
  if (!cookieId) return null;
  return findDemoSandboxById(cookieId);
}

export async function getDemoAgentCredentials(): Promise<{
  apiKey: string;
  expiresAt: string;
} | null> {
  const sandbox = await getDemoSandboxForSession();
  if (!sandbox) return null;
  return {
    apiKey: sandbox.apiKeyPlaintext,
    expiresAt: sandbox.expiresAt.toISOString(),
  };
}
