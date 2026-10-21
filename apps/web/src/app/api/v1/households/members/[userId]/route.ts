import { NextRequest } from "next/server";
import { z } from "zod";
import { HouseholdService, membershipRoleSchema } from "@ovenlovin/core";
import { getDatabase } from "@ovenlovin/db";
import { handleApiError, requireResourceId } from "@/lib/api/errors";
import {
  getRequestContext,
  requireHouseholdId,
  requireOwnerRole,
  requireUserOrKeyOwner,
} from "@/lib/api/middleware";
import { jsonResponse, noContentResponse } from "@/lib/api/response";
import { readJsonBody } from "@/lib/api/read-json";

const patchSchema = z.object({
  role: membershipRoleSchema,
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const context = await getRequestContext(request);
    requireOwnerRole(context);
    const householdId = requireHouseholdId(context);
    const actorUserId = requireUserOrKeyOwner(context);
    const { userId } = await params;
    requireResourceId("User", userId);
    const body = await readJsonBody(request, patchSchema);
    const membership = await new HouseholdService(getDatabase()).updateMemberRole({
      householdId,
      targetUserId: userId,
      role: body.role,
      actorUserId,
      actorRole: context.membershipRole ?? "owner",
    });
    return jsonResponse(membership);
  } catch (error) {
    return handleApiError(error, request.url);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const context = await getRequestContext(request);
    requireOwnerRole(context);
    const householdId = requireHouseholdId(context);
    const actorUserId = requireUserOrKeyOwner(context);
    const { userId } = await params;
    requireResourceId("User", userId);
    await new HouseholdService(getDatabase()).removeMember({
      householdId,
      targetUserId: userId,
      actorUserId,
      actorRole: context.membershipRole ?? "owner",
    });
    return noContentResponse();
  } catch (error) {
    return handleApiError(error, request.url);
  }
}
