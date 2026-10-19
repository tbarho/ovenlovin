import { NextRequest } from "next/server";
import { HouseholdService } from "@ovenlovin/core";
import { getDatabase } from "@ovenlovin/db";
import { handleApiError, NotFoundError } from "@/lib/api/errors";
import { getRequestContext, requireHouseholdId } from "@/lib/api/middleware";
import { jsonResponse } from "@/lib/api/response";

export async function GET(request: NextRequest) {
  try {
    const context = await getRequestContext(request);
    const service = new HouseholdService(getDatabase());

    if (context.userId) {
      const items = await service.listHouseholdsForUser(context.userId);
      const activeHouseholdId = context.householdId ?? null;
      return jsonResponse({
        items: items.map((item) => ({
          ...item,
          active: item.household.id === activeHouseholdId,
        })),
        activeHouseholdId,
      });
    }

    const householdId = requireHouseholdId(context);
    const household = await service.getHousehold(householdId);
    if (!household) {
      throw new NotFoundError("Household", householdId);
    }
    if (context.apiKeyCreatedBy) {
      const owned = await service.listHouseholdsForUser(context.apiKeyCreatedBy);
      const match = owned.find((item) => item.household.id === householdId);
      if (match) {
        return jsonResponse({
          items: [{ ...match, active: true }],
          activeHouseholdId: householdId,
        });
      }
    }
    return jsonResponse({
      items: [{ household, membership: null, active: true }],
      activeHouseholdId: householdId,
    });
  } catch (error) {
    return handleApiError(error, request.url);
  }
}
