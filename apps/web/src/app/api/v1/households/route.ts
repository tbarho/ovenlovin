import { NextRequest } from "next/server";
import { handleApiError, NotFoundError } from "@/lib/api/errors";
import { jsonResponse } from "@/lib/api/response";
import { getRequestContext, requireHouseholdId } from "@/lib/api/middleware";
import { HouseholdService, updateHouseholdNameSchema } from "@ovenlovin/core";
import { getDatabase } from "@ovenlovin/db";

export async function GET(request: NextRequest) {
  try {
    const context = await getRequestContext(request);
    const householdId = requireHouseholdId(context);

    const db = getDatabase();
    const service = new HouseholdService(db);

    const household = await service.getHousehold(householdId);

    if (!household) {
      throw new NotFoundError("Household", householdId);
    }

    return jsonResponse(household);
  } catch (error) {
    return handleApiError(error, request.url);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const context = await getRequestContext(request);
    const householdId = requireHouseholdId(context);
    const body = updateHouseholdNameSchema.parse(await request.json());
    const household = await new HouseholdService(getDatabase()).updateHouseholdName({
      householdId,
      name: body.name,
      actorRole: context.membershipRole,
      isBot: context.isBot,
    });
    return jsonResponse(household);
  } catch (error) {
    return handleApiError(error, request.url);
  }
}
