import { NextRequest } from "next/server";
import { ApiKeyService } from "@ovenlovin/core";
import { getDatabase } from "@ovenlovin/db";
import { handleApiError, NotFoundError, requireResourceId } from "@/lib/api/errors";
import { noContentResponse } from "@/lib/api/response";
import {
  getRequestContext,
  requireAdminRole,
  requireHouseholdId,
  requireUserId,
} from "@/lib/api/middleware";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const context = await getRequestContext(request);
    requireUserId(context);
    requireAdminRole(context);
    const householdId = requireHouseholdId(context);
    const { id } = await params;
    requireResourceId("API key", id);

    const db = getDatabase();
    const revoked = await new ApiKeyService(db).revoke(id, householdId);
    if (!revoked) {
      throw new NotFoundError("API key", id);
    }

    return noContentResponse();
  } catch (error) {
    return handleApiError(error, request.url);
  }
}
