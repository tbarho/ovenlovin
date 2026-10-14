import { NextRequest } from "next/server";
import { handleApiError, NotFoundError } from "@/lib/api/errors";
import { jsonResponse, noContentResponse } from "@/lib/api/response";
import { getRequestContext, requireHouseholdId, requireAdminRole } from "@/lib/api/middleware";
import { PeopleService } from "@ovenlovin/core";
import { getDatabase } from "@ovenlovin/db";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; prefId: string }> }
) {
  try {
    const context = await getRequestContext(request);
    requireHouseholdId(context);

    const { id: personId, prefId } = await params;
    const db = getDatabase();
    const service = new PeopleService(db);

    const person = await service.getPerson(personId);
    if (!person) {
      throw new NotFoundError("Person", personId);
    }

    const preference = await service.getPreference(prefId);
    if (!preference || preference.personId !== personId) {
      throw new NotFoundError("Preference", prefId);
    }

    return jsonResponse(preference);
  } catch (error) {
    return handleApiError(error, request.url);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; prefId: string }> }
) {
  try {
    const context = await getRequestContext(request);
    requireAdminRole(context);
    requireHouseholdId(context);

    const { id: personId, prefId } = await params;
    const db = getDatabase();
    const service = new PeopleService(db);

    const person = await service.getPerson(personId);
    if (!person) {
      throw new NotFoundError("Person", personId);
    }

    const preference = await service.getPreference(prefId);
    if (!preference || preference.personId !== personId) {
      throw new NotFoundError("Preference", prefId);
    }

    await service.deletePreference(prefId);
    return noContentResponse();
  } catch (error) {
    return handleApiError(error, request.url);
  }
}
