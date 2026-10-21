import { NextRequest } from "next/server";
import { handleApiError } from "@/lib/api/errors";
import { jsonResponse, createdResponse } from "@/lib/api/response";
import { getRequestContext, requireHouseholdId, requireAdminRole } from "@/lib/api/middleware";
import { createPreferenceBodySchema, PeopleService } from "@ovenlovin/core";
import { readJsonBody } from "@/lib/api/read-json";
import { getDatabase } from "@ovenlovin/db";
import { loadOwned } from "@/lib/api/owned";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await getRequestContext(request);
    const householdId = requireHouseholdId(context);

    const { id: personId } = await params;
    const type = new URL(request.url).searchParams.get("type") ?? undefined;

    const db = getDatabase();
    const service = new PeopleService(db);

    await loadOwned("Person", personId, householdId, (id) => service.getPerson(id));

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
    const householdId = requireHouseholdId(context);

    const { id: personId } = await params;
    const body = await readJsonBody(request, createPreferenceBodySchema);
    const type = body.type ?? "love";
    const value = body.value;

    const db = getDatabase();
    const service = new PeopleService(db);

    await loadOwned("Person", personId, householdId, (id) => service.getPerson(id));

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
