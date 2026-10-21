import { NextRequest } from "next/server";
import { handleApiError } from "@/lib/api/errors";
import { loadOwned, loadOwnedChild } from "@/lib/api/owned";
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
    const householdId = requireHouseholdId(context);

    const { id: personId, prefId } = await params;
    const db = getDatabase();
    const service = new PeopleService(db);

    await loadOwned("Person", personId, householdId, (id) => service.getPerson(id));
    const preference = await loadOwnedChild(
      "Preference",
      prefId,
      (id) => service.getPreference(id),
      (row) => row.personId === personId
    );

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
    const householdId = requireHouseholdId(context);

    const { id: personId, prefId } = await params;
    const db = getDatabase();
    const service = new PeopleService(db);

    await loadOwned("Person", personId, householdId, (id) => service.getPerson(id));
    await loadOwnedChild(
      "Preference",
      prefId,
      (id) => service.getPreference(id),
      (row) => row.personId === personId
    );

    await service.deletePreference(prefId);
    return noContentResponse();
  } catch (error) {
    return handleApiError(error, request.url);
  }
}
