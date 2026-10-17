import { NextRequest } from "next/server";
import { HouseholdService } from "@ovenlovin/core";
import { getDatabase } from "@ovenlovin/db";
import { handleApiError } from "@/lib/api/errors";
import { getRequestContext, requireHouseholdId } from "@/lib/api/middleware";
import { jsonResponse } from "@/lib/api/response";

export async function GET(request: NextRequest) {
  try {
    const context = await getRequestContext(request);
    const householdId = requireHouseholdId(context);
    const items = await new HouseholdService(getDatabase()).listMembers(householdId);
    return jsonResponse({ items });
  } catch (error) {
    return handleApiError(error, request.url);
  }
}
