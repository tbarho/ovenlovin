import { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { HouseholdService, selectActiveMembership } from "@ovenlovin/core";
import { getDatabase } from "@ovenlovin/db";
import { handleApiError } from "@/lib/api/errors";
import { getRequestContext, requireHouseholdId, requireUserId } from "@/lib/api/middleware";
import { jsonResponse } from "@/lib/api/response";
import { HOUSEHOLD_COOKIE, householdCookieOptions } from "@/lib/kitchen-cookies";

export async function POST(request: NextRequest) {
  try {
    const context = await getRequestContext(request);
    const householdId = requireHouseholdId(context);
    const userId = requireUserId(context);
    const service = new HouseholdService(getDatabase());
    await service.leaveHousehold({ householdId, userId });
    const remaining = await service.getMembershipsForUser(userId);
    const next = selectActiveMembership(remaining);
    const store = await cookies();
    if (next) {
      store.set(HOUSEHOLD_COOKIE, next.householdId, householdCookieOptions);
    } else {
      store.delete(HOUSEHOLD_COOKIE);
    }
    return jsonResponse({
      leftHouseholdId: householdId,
      activeHouseholdId: next?.householdId ?? null,
    });
  } catch (error) {
    return handleApiError(error, request.url);
  }
}
