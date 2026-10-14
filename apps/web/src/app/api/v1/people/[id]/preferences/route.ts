import { NextRequest } from "next/server";
import { handleApiError, BadRequestError, NotFoundError } from "@/lib/api/errors";
import { jsonResponse, createdResponse } from "@/lib/api/response";
import { getRequestContext, requireHouseholdId, requireAdminRole } from "@/lib/api/middleware";
import { PeopleService } from "@ovenlovin/core";
import { getDatabase } from "@ovenlovin/db";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await getRequestContext(request);
    requireHouseholdId(context);

    const { id: personId } = await params;
    const type = new URL(request.url).searchParams.get("type") ?? undefined;

    const db = getDatabase();
    const service = new PeopleService(db);

    const person = await service.getPerson(personId);
    if (!person) {
      throw new NotFoundError("Person", personId);
    }

    const preferences = await service.getPreferencesForPerson(personId, type);
    return jsonResponse(preferences);
  } catch (error) {
    return handleApiError(error, request.url);
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await getRequestContext(request);
    requireAdminRole(context);
    requireHouseholdId(context);

    const { id: personId } = await params;
    const body = (await request.json()) as { type?: string; value?: string; weight?: number };

    const type = body.type?.trim() || "love";
    const value = body.value?.trim() ?? "";
    if (!value) {
      throw new BadRequestError("Provide a value such as salmon, Mexican, or spicy.");
    }

    const db = getDatabase();
    const service = new PeopleService(db);

    const person = await service.getPerson(personId);
    if (!person) {
      throw new NotFoundError("Person", personId);
    }

    const createdBy = context.userId || context.clientId || "system";
    const preference = await service.createPreference({
      personId,
      type,
      value,
      weight: body.weight ?? 1,
      createdBy,
    });

    return createdResponse(preference, `/api/v1/people/${personId}/preferences/${preference.id}`);
  } catch (error) {
    return handleApiError(error, request.url);
  }
}
