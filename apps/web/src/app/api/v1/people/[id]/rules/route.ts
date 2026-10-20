import { NextRequest } from "next/server";
import { BadRequestError, handleApiError } from "@/lib/api/errors";
import { jsonResponse, createdResponse } from "@/lib/api/response";
import {
  getRequestContext,
  requireHouseholdId,
  requireAdminRole,
  getIdempotencyKey,
} from "@/lib/api/middleware";
import { PeopleService, resolveWriteActor } from "@ovenlovin/core";
import {
  ambiguousRuleTargetMessage,
  canonicalizePersonRuleTarget,
  unknownRuleTargetMessage,
  type PersonRuleKind,
} from "@ovenlovin/allergens";
import { getDatabase } from "@ovenlovin/db";
import { assertPersonHousehold } from "@/lib/api/people";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await getRequestContext(request);
    const householdId = requireHouseholdId(context);

    const { id: personId } = await params;

    const db = getDatabase();
    const service = new PeopleService(db);

    const person = await service.getPerson(personId);
    assertPersonHousehold(person, householdId, personId);

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
    assertPersonHousehold(person, householdId, personId);

    const actor = resolveWriteActor({
      userId: context.userId,
      apiKeyId: context.clientId,
      apiKeyCreatedBy: context.apiKeyCreatedBy,
    });

    const confirmUnknown = Boolean(body.confirmUnknown);
    const kind = (body.kind ?? "allergen") as PersonRuleKind;
    const target = String(body.target ?? "");
    const canonical = canonicalizePersonRuleTarget(kind, target);
    if (canonical.ambiguous?.length) {
      throw new BadRequestError(ambiguousRuleTargetMessage(target, canonical.ambiguous));
    }
    if (kind === "allergen" && !canonical.resolved && !confirmUnknown) {
      throw new BadRequestError(unknownRuleTargetMessage(target));
    }

    const rest = { ...body };
    delete rest.confirmUnknown;
    const { rule, created } = await service.createRule({
      ...rest,
      personId,
      kind: canonical.kind,
      target: canonical.target,
      setBy: actor.setBy,
      createdBy: actor.createdBy,
      createdByApiKeyId: actor.createdByApiKeyId,
    });

    if (!created) return jsonResponse(rule);
    return createdResponse(rule, `/api/v1/people/${personId}/rules/${rule.id}`);
  } catch (error) {
    return handleApiError(error, request.url);
  }
}
