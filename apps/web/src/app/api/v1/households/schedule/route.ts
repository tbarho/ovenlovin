import { NextRequest } from "next/server";
import { replaceScheduleBodySchema, ScheduleService } from "@ovenlovin/core";
import { readJsonBody } from "@/lib/api/read-json";
import { getDatabase } from "@ovenlovin/db";
import { handleApiError } from "@/lib/api/errors";
import { jsonResponse } from "@/lib/api/response";
import {
  getRequestContext,
  requireHouseholdId,
  requireWritableHousehold,
} from "@/lib/api/middleware";

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
    const householdId = requireWritableHousehold(context);
    const createdBy = context.userId || context.clientId || householdId;
    const body = await readJsonBody(request, replaceScheduleBodySchema);
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
