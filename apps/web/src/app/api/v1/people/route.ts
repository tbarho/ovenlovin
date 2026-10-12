import { NextRequest } from "next/server";
import { handleApiError } from "@/lib/api/errors";
import { paginatedResponse, createdResponse } from "@/lib/api/response";
import { getRequestContext, requireHouseholdId, getIdempotencyKey } from "@/lib/api/middleware";
import { PeopleService } from "@ovenlovin/core";
import { getDatabase } from "@ovenlovin/db";

export async function GET(request: NextRequest) {
  try {
    const context = await getRequestContext(request);
    const householdId = requireHouseholdId(context);

    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get("limit") || "20");
    const cursor = url.searchParams.get("cursor") || undefined;

    const db = getDatabase();
    const service = new PeopleService(db);

    const result = await service.listPeopleByHousehold(householdId, {
      limit,
      cursor,
    });

    return paginatedResponse(result);
  } catch (error) {
    return handleApiError(error, request.url);
  }
}

export async function POST(request: NextRequest) {
  try {
    const context = await getRequestContext(request);
    const householdId = requireHouseholdId(context);
    const idempotencyKey = getIdempotencyKey(request);

    const body = await request.json();

    const db = getDatabase();
    const service = new PeopleService(db);

    const createdBy = context.userId || context.clientId || "system";

    const person = await service.createPerson({
      ...body,
      householdId,
      createdBy,
    });

    return createdResponse(person, `/api/v1/people/${person.id}`);
  } catch (error) {
    return handleApiError(error, request.url);
  }
}
