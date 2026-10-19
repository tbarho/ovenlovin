import { cookies, headers } from "next/headers";
import { NextRequest } from "next/server";
import {
  HouseholdService,
  InviteService,
  inviteNeedsSignedInUserMessage,
  isInviteToken,
} from "@ovenlovin/core";
import { getDatabase } from "@ovenlovin/db";
import { handleApiError, NotFoundError, UnauthorizedError } from "@/lib/api/errors";
import { getRequestContext, requireUserId } from "@/lib/api/middleware";
import { jsonResponse } from "@/lib/api/response";
import { HOUSEHOLD_COOKIE, INVITE_COOKIE, householdCookieOptions } from "@/lib/kitchen-cookies";
import { resolveOrigin } from "@/lib/origin";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    if (!isInviteToken(token)) {
      throw new NotFoundError("Invite");
    }
    const context = await getRequestContext(request);
    if (!context.userId) {
      const origin = resolveOrigin(await headers());
      throw new UnauthorizedError(
        inviteNeedsSignedInUserMessage(origin, token, Boolean(context.clientId))
      );
    }
    const userId = requireUserId(context);
    const db = getDatabase();
    const accepted = await new InviteService(db).acceptInvite(token, userId);
    const household = await new HouseholdService(db).getHousehold(accepted.householdId);
    if (!household) {
      throw new NotFoundError("Household", accepted.householdId);
    }
    const store = await cookies();
    store.set(HOUSEHOLD_COOKIE, accepted.householdId, householdCookieOptions);
    store.delete(INVITE_COOKIE);
    return jsonResponse({
      household,
      membership: accepted.membership,
      alreadyMember: accepted.alreadyMember,
    });
  } catch (error) {
    return handleApiError(error, request.url);
  }
}
