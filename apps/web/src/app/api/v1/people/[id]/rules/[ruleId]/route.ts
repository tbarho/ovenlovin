import { NextRequest } from "next/server";
import { BadRequestError, handleApiError, NotFoundError } from "@/lib/api/errors";
import { jsonResponse, noContentResponse } from "@/lib/api/response";
import { getRequestContext, requireHouseholdId, requireAdminRole } from "@/lib/api/middleware";
import { PeopleService, resolveWriteActor } from "@ovenlovin/core";
import {
  ambiguousRuleTargetMessage,
  canonicalizePersonRuleTarget,
  unknownRuleTargetMessage,
  type PersonRuleKind,
} from "@ovenlovin/allergens";
import { getDatabase } from "@ovenlovin/db";
import { assertPersonHousehold } from "@/lib/api/people";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; ruleId: string }> }
) {
  try {
    const context = await getRequestContext(request);
    const householdId = requireHouseholdId(context);

    const { id: personId, ruleId } = await params;

    const db = getDatabase();
    const service = new PeopleService(db);

    const person = await service.getPerson(personId);
    assertPersonHousehold(person, householdId, personId);

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
    const householdId = requireHouseholdId(context);

    const { id: personId, ruleId } = await params;
    const body = await request.json();

    const db = getDatabase();
    const service = new PeopleService(db);

    const person = await service.getPerson(personId);
    assertPersonHousehold(person, householdId, personId);

    const existingRule = await service.getRule(ruleId);
    if (!existingRule) {
      throw new NotFoundError("Rule", ruleId);
    }

    if (existingRule.personId !== personId) {
      throw new NotFoundError("Rule", ruleId);
    }

    const actor = resolveWriteActor({
      userId: context.userId,
      apiKeyId: context.clientId,
      apiKeyCreatedBy: context.apiKeyCreatedBy,
    });

    const confirmUnknown = Boolean(body.confirmUnknown);
    const nextKind = (body.kind ?? existingRule.kind) as PersonRuleKind;
    const nextTarget = String(body.target ?? existingRule.target);
    const canonical = canonicalizePersonRuleTarget(nextKind, nextTarget);
    if (canonical.ambiguous?.length) {
      throw new BadRequestError(ambiguousRuleTargetMessage(nextTarget, canonical.ambiguous));
    }
    const identityChanged = nextKind !== existingRule.kind || nextTarget !== existingRule.target;
    if (identityChanged && !canonical.resolved && !confirmUnknown) {
      throw new BadRequestError(unknownRuleTargetMessage(nextTarget, nextKind));
    }
    const rest = { ...body };
    delete rest.confirmUnknown;
    const updated = await service.updateRule(ruleId, {
      ...rest,
      kind: body.kind ? canonical.kind : undefined,
      target: body.target ? canonical.target : undefined,
      setBy: actor.setBy,
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
    const householdId = requireHouseholdId(context);

    const { id: personId, ruleId } = await params;

    const db = getDatabase();
    const service = new PeopleService(db);

    const person = await service.getPerson(personId);
    assertPersonHousehold(person, householdId, personId);

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
