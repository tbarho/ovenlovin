import { NextRequest } from "next/server";
import { ScheduleService } from "@ovenlovin/core";
import { getDatabase } from "@ovenlovin/db";
import { BadRequestError, handleApiError } from "@/lib/api/errors";
import { jsonResponse } from "@/lib/api/response";
import { getRequestContext, requireHouseholdId } from "@/lib/api/middleware";

export async function GET(request: NextRequest) {
  try {
    const context = await getRequestContext(request);
    const householdId = requireHouseholdId(context);
    const schedule = await new ScheduleService(getDatabase()).getSchedule(householdId);
    return jsonResponse(schedule);
  } catch (error) {
    return handleApiError(error, request.url);
  }
}

export async function PUT(request: NextRequest) {
  try {
    const context = await getRequestContext(request);
    const householdId = requireHouseholdId(context);
    const createdBy = context.userId || context.clientId || householdId;
    const body = (await request.json()) as { week?: unknown };
    if (!Array.isArray(body.week)) {
      throw new BadRequestError("Provide week: an array of weekday availability objects");
    }
    const schedule = await new ScheduleService(getDatabase()).replaceSchedule(
      householdId,
      body.week,
      createdBy
    );
    return jsonResponse(schedule);
  } catch (error) {
    return handleApiError(error, request.url);
  }
}
