import { NextRequest } from "next/server";
import { handleApiError, NotFoundError } from "@/lib/api/errors";
import { jsonResponse, createdResponse } from "@/lib/api/response";
import {
  getRequestContext,
  requireHouseholdId,
  requireAdminRole,
  getIdempotencyKey,
} from "@/lib/api/middleware";
import { PeopleService } from "@ovenlovin/core";
import { getDatabase } from "@ovenlovin/db";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await getRequestContext(request);
    requireHouseholdId(context);

    const { id: personId } = await params;

    const db = getDatabase();
    const service = new PeopleService(db);

    const person = await service.getPerson(personId);
    if (!person) {
      throw new NotFoundError("Person", personId);
    }

    const rules = await service.getRulesForPerson(personId);

    return jsonResponse(rules);
  } catch (error) {
    return handleApiError(error, request.url);
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await getRequestContext(request);
    requireAdminRole(context);
    const householdId = requireHouseholdId(context);
    const idempotencyKey = getIdempotencyKey(request);

    const { id: personId } = await params;
    const body = await request.json();

    const db = getDatabase();
    const service = new PeopleService(db);

    const person = await service.getPerson(personId);
    if (!person) {
      throw new NotFoundError("Person", personId);
    }

    const setBy = context.userId || "system";
    const createdBy = context.userId || context.clientId || "system";

    const rule = await service.createRule({
      ...body,
      personId,
      setBy,
      createdBy,
    });

    return createdResponse(rule, `/api/v1/people/${personId}/rules/${rule.id}`);
  } catch (error) {
    return handleApiError(error, request.url);
  }
}
