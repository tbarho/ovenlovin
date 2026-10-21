import { NextRequest } from "next/server";
import { handleApiError, NotFoundError } from "@/lib/api/errors";
import { jsonResponse, noContentResponse } from "@/lib/api/response";
import { getRequestContext, requireAdminRole, requireHouseholdId } from "@/lib/api/middleware";
import { PeopleService, updatePersonBodySchema } from "@ovenlovin/core";
import { readJsonBody } from "@/lib/api/read-json";
import { getDatabase } from "@ovenlovin/db";
import { loadOwned } from "@/lib/api/owned";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await getRequestContext(request);
    const householdId = requireHouseholdId(context);

    const { id } = await params;

    const db = getDatabase();
    const service = new PeopleService(db);

    const person = await loadOwned("Person", id, householdId, (personId) =>
      service.getPerson(personId)
    );

    return jsonResponse(person);
  } catch (error) {
    return handleApiError(error, request.url);
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await getRequestContext(request);
    requireAdminRole(context);
    const householdId = requireHouseholdId(context);

    const { id } = await params;
    const body = await readJsonBody(request, updatePersonBodySchema);

    const db = getDatabase();
    const service = new PeopleService(db);

    await loadOwned("Person", id, householdId, (personId) => service.getPerson(personId));

    const person = await service.updatePerson(id, body);

    if (!person) {
      throw new NotFoundError("Person", id);
    }

    return jsonResponse(person);
  } catch (error) {
    return handleApiError(error, request.url);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const context = await getRequestContext(request);
    requireAdminRole(context);
    const householdId = requireHouseholdId(context);

    const { id } = await params;

    const db = getDatabase();
    const service = new PeopleService(db);

    await loadOwned("Person", id, householdId, (personId) => service.getPerson(personId));

    const deleted = await service.deletePerson(id);

    if (!deleted) {
      throw new NotFoundError("Person", id);
    }

    return noContentResponse();
  } catch (error) {
    return handleApiError(error, request.url);
  }
}
