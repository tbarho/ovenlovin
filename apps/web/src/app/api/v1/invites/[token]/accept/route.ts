import { cookies } from "next/headers";
import { NextRequest } from "next/server";
import { HouseholdService, InviteService, isInviteToken } from "@ovenlovin/core";
import { getDatabase } from "@ovenlovin/db";
import { handleApiError, NotFoundError } from "@/lib/api/errors";
import { getRequestContext, requireUserId } from "@/lib/api/middleware";
import { jsonResponse } from "@/lib/api/response";
import { HOUSEHOLD_COOKIE, INVITE_COOKIE, householdCookieOptions } from "@/lib/kitchen-cookies";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const context = await getRequestContext(request);
    const userId = requireUserId(context);
    const { token } = await params;
    if (!isInviteToken(token)) {
      throw new NotFoundError("Invite");
    }
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
