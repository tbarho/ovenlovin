import { NextRequest } from "next/server";
import { handleApiError, NotFoundError } from "@/lib/api/errors";
import { jsonResponse, noContentResponse } from "@/lib/api/response";
import {
  getRequestContext,
  requireHouseholdId,
  requireAdminRole,
} from "@/lib/api/middleware";
import { PeopleService } from "@ovenlovin/core";
import { getDatabase } from "@ovenlovin/db";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; ruleId: string }> }
) {
  try {
    const context = await getRequestContext(request);
    requireHouseholdId(context);

    const { id: personId, ruleId } = await params;

    const db = getDatabase();
    const service = new PeopleService(db);

    const person = await service.getPerson(personId);
    if (!person) {
      throw new NotFoundError("Person", personId);
    }

    const rule = await service.getRule(ruleId);
    if (!rule) {
      throw new NotFoundError("Rule", ruleId);
    }

    if (rule.personId !== personId) {
      throw new NotFoundError("Rule", ruleId);
    }

    return jsonResponse(rule);
  } catch (error) {
    return handleApiError(error, request.url);
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; ruleId: string }> }
) {
  try {
    const context = await getRequestContext(request);
    requireAdminRole(context);
    requireHouseholdId(context);

    const { id: personId, ruleId } = await params;
    const body = await request.json();

    const db = getDatabase();
    const service = new PeopleService(db);

    const person = await service.getPerson(personId);
    if (!person) {
      throw new NotFoundError("Person", personId);
    }

    const existingRule = await service.getRule(ruleId);
    if (!existingRule) {
      throw new NotFoundError("Rule", ruleId);
    }

    if (existingRule.personId !== personId) {
      throw new NotFoundError("Rule", ruleId);
    }

    const setBy = context.userId || "system";

    const updated = await service.updateRule(ruleId, {
      ...body,
      setBy,
    });

    if (!updated) {
      throw new NotFoundError("Rule", ruleId);
    }

    return jsonResponse(updated);
  } catch (error) {
    return handleApiError(error, request.url);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; ruleId: string }> }
) {
  try {
    const context = await getRequestContext(request);
    requireAdminRole(context);
    requireHouseholdId(context);

    const { id: personId, ruleId } = await params;

    const db = getDatabase();
    const service = new PeopleService(db);

    const person = await service.getPerson(personId);
    if (!person) {
      throw new NotFoundError("Person", personId);
    }

    const existingRule = await service.getRule(ruleId);
    if (!existingRule) {
      throw new NotFoundError("Rule", ruleId);
    }

    if (existingRule.personId !== personId) {
      throw new NotFoundError("Rule", ruleId);
    }

    await service.deleteRule(ruleId);

    return noContentResponse();
  } catch (error) {
    return handleApiError(error, request.url);
  }
}
