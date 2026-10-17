import { NextRequest } from "next/server";
import { z } from "zod";
import { cookies } from "next/headers";
import { HouseholdService } from "@ovenlovin/core";
import { getDatabase } from "@ovenlovin/db";
import { ForbiddenError, handleApiError, NotFoundError } from "@/lib/api/errors";
import { getRequestContext, requireUserId } from "@/lib/api/middleware";
import { jsonResponse } from "@/lib/api/response";
import { HOUSEHOLD_COOKIE, householdCookieOptions } from "@/lib/kitchen-cookies";

const bodySchema = z.object({
  householdId: z.string().uuid(),
});

export async function POST(request: NextRequest) {
  try {
    const context = await getRequestContext(request);
    const userId = requireUserId(context);
    const body = bodySchema.parse(await request.json().catch(() => ({})));
    const service = new HouseholdService(getDatabase());
    const kitchens = await service.listHouseholdsForUser(userId);
    const selected = kitchens.find((item) => item.household.id === body.householdId);
    if (!selected) {
      throw new ForbiddenError("You are not a member of that kitchen.");
    }
    const household = await service.getHousehold(body.householdId);
    if (!household) {
      throw new NotFoundError("Household", body.householdId);
    }
    const store = await cookies();
    store.set(HOUSEHOLD_COOKIE, body.householdId, householdCookieOptions);
    return jsonResponse({ household, membership: selected.membership });
  } catch (error) {
    return handleApiError(error, request.url);
  }
}
