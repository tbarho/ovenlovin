import { NextRequest } from "next/server";
import { handleApiError, NotFoundError } from "@/lib/api/errors";
import { jsonResponse, noContentResponse } from "@/lib/api/response";
import { getRequestContext, requireHouseholdId } from "@/lib/api/middleware";
import { PeopleService } from "@ovenlovin/core";
import { getDatabase } from "@ovenlovin/db";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await getRequestContext(request);
    requireHouseholdId(context);

    const { id } = await params;

    const db = getDatabase();
    const service = new PeopleService(db);

    const person = await service.getPerson(id);

    if (!person) {
      throw new NotFoundError("Person", id);
    }

    return jsonResponse(person);
  } catch (error) {
    return handleApiError(error, request.url);
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await getRequestContext(request);
    requireHouseholdId(context);

    const { id } = await params;
    const body = await request.json();

    const db = getDatabase();
    const service = new PeopleService(db);

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
    requireHouseholdId(context);

    const { id } = await params;

    const db = getDatabase();
    const service = new PeopleService(db);

    const deleted = await service.deletePerson(id);

    if (!deleted) {
      throw new NotFoundError("Person", id);
    }

    return noContentResponse();
  } catch (error) {
    return handleApiError(error, request.url);
  }
}
