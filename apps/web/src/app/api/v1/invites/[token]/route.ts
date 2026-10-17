import { NextRequest } from "next/server";
import { InviteService, isInviteToken } from "@ovenlovin/core";
import { getDatabase } from "@ovenlovin/db";
import { handleApiError, NotFoundError } from "@/lib/api/errors";
import { jsonResponse } from "@/lib/api/response";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    if (!isInviteToken(token)) {
      throw new NotFoundError("Invite");
    }
    const preview = await new InviteService(getDatabase()).previewInvite(token);
    if (!preview) {
      throw new NotFoundError("Invite");
    }
    return jsonResponse(preview);
  } catch (error) {
    return handleApiError(error, request.url);
  }
}
