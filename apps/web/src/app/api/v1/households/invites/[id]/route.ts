import { NextRequest } from "next/server";
import { InviteService } from "@ovenlovin/core";
import { getDatabase } from "@ovenlovin/db";
import { handleApiError, requireResourceId } from "@/lib/api/errors";
import { getRequestContext, requireAdminRole, requireHouseholdId } from "@/lib/api/middleware";
import { jsonResponse } from "@/lib/api/response";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const context = await getRequestContext(request);
    requireAdminRole(context);
    const householdId = requireHouseholdId(context);
    const { id } = await params;
    requireResourceId("Invite", id);
    const invite = await new InviteService(getDatabase()).revokeInvite(
      id,
      householdId,
      context.membershipRole ?? "admin"
    );
    return jsonResponse(invite);
  } catch (error) {
    return handleApiError(error, request.url);
  }
}
