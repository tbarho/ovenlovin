import { NextRequest } from "next/server";
import {
  HouseholdService,
  PeopleService,
  updateHouseholdServingsSettingsSchema,
} from "@ovenlovin/core";
import { getDatabase } from "@ovenlovin/db";
import { handleApiError, NotFoundError } from "@/lib/api/errors";
import { readJsonBody } from "@/lib/api/read-json";
import { jsonResponse } from "@/lib/api/response";
import {
  getRequestContext,
  requireHouseholdId,
  requireWritableHousehold,
} from "@/lib/api/middleware";

async function settingsForHousehold(householdId: string) {
  const db = getDatabase();
  const households = new HouseholdService(db);
  const household = await households.getHousehold(householdId);
  if (!household) throw new NotFoundError("Household", householdId);
  const people = await new PeopleService(db).listPeopleByHousehold(householdId, { limit: 40 });
  return households.servingsSettingsFor(household, people.items.length);
}

export async function GET(request: NextRequest) {
  try {
    const context = await getRequestContext(request);
    const householdId = requireHouseholdId(context);
    return jsonResponse(await settingsForHousehold(householdId));
  } catch (error) {
    return handleApiError(error, request.url);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const context = await getRequestContext(request);
    const householdId = requireWritableHousehold(context);
    const body = await readJsonBody(request, updateHouseholdServingsSettingsSchema);
    await new HouseholdService(getDatabase()).updateServingsSettings(householdId, body);
    return jsonResponse(await settingsForHousehold(householdId));
  } catch (error) {
    return handleApiError(error, request.url);
  }
}
