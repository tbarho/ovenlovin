import { NextRequest } from "next/server";
import { HouseholdService } from "@ovenlovin/core";
import { getDatabase } from "@ovenlovin/db";
import { handleApiError } from "@/lib/api/errors";
import { getRequestContext, requireUserId } from "@/lib/api/middleware";
import { jsonResponse } from "@/lib/api/response";

export async function GET(request: NextRequest) {
  try {
    const context = await getRequestContext(request);
    const userId = requireUserId(context);
    const items = await new HouseholdService(getDatabase()).listHouseholdsForUser(userId);
    return jsonResponse({
      items,
      activeHouseholdId: context.householdId ?? null,
    });
  } catch (error) {
    return handleApiError(error, request.url);
  }
}
