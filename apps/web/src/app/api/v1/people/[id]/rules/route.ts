import { NextRequest } from "next/server";
import { BadRequestError, handleApiError, NotFoundError } from "@/lib/api/errors";
import { jsonResponse, createdResponse } from "@/lib/api/response";
import {
  getRequestContext,
  requireHouseholdId,
  requireAdminRole,
  getIdempotencyKey,
} from "@/lib/api/middleware";
import { PeopleService, resolveWriteActor } from "@ovenlovin/core";
import {
  canonicalizePersonRuleTarget,
  unknownRuleTargetMessage,
  type PersonRuleKind,
} from "@ovenlovin/allergens";
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

    const actor = resolveWriteActor({
      userId: context.userId,
      apiKeyId: context.clientId,
      apiKeyCreatedBy: context.apiKeyCreatedBy,
    });

    const confirmUnknown = Boolean(body.confirmUnknown);
    const kind = (body.kind ?? "allergen") as PersonRuleKind;
    const target = String(body.target ?? "");
    const canonical = canonicalizePersonRuleTarget(kind, target);
    if (kind === "allergen" && !canonical.resolved && !confirmUnknown) {
      throw new BadRequestError(unknownRuleTargetMessage(target));
    }

    const rest = { ...body };
    delete rest.confirmUnknown;
    if (typeof rest.severity === "string") {
      const existing = await service.findMatchingRule({
        personId,
        kind: canonical.kind,
        target: canonical.target,
        severity: rest.severity,
      });
      if (existing) {
        return jsonResponse(existing);
      }
    }
    const rule = await service.createRule({
      ...rest,
      personId,
      kind: canonical.kind,
      target: canonical.target,
      setBy: actor.setBy,
      createdBy: actor.createdBy,
      createdByApiKeyId: actor.createdByApiKeyId,
    });

    return createdResponse(rule, `/api/v1/people/${personId}/rules/${rule.id}`);
  } catch (error) {
    return handleApiError(error, request.url);
  }
}
