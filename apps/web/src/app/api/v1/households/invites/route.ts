import { headers } from "next/headers";
import { NextRequest } from "next/server";
import { createInviteInputSchema, InviteService, invitePath } from "@ovenlovin/core";
import { getDatabase } from "@ovenlovin/db";
import { handleApiError } from "@/lib/api/errors";
import {
  getRequestContext,
  requireAdminRole,
  requireHouseholdId,
  requireUserOrKeyOwner,
} from "@/lib/api/middleware";
import { createdResponse, jsonResponse } from "@/lib/api/response";
import { resolveOrigin } from "@/lib/origin";
import { readJsonBody } from "@/lib/api/read-json";

function inviteUrl(origin: string, token: string): string {
  return `${origin}${invitePath(token)}`;
}

export async function GET(request: NextRequest) {
  try {
    const context = await getRequestContext(request);
    requireAdminRole(context);
    const householdId = requireHouseholdId(context);
    const origin = resolveOrigin(await headers());
    const items = await new InviteService(getDatabase()).listPendingInvites(
      householdId,
      context.membershipRole ?? "admin"
    );
    return jsonResponse({
      items: items.map((invite) => ({
        ...invite,
        url: inviteUrl(origin, invite.token),
      })),
    });
  } catch (error) {
    return handleApiError(error, request.url);
  }
}

export async function POST(request: NextRequest) {
  try {
    const context = await getRequestContext(request);
    requireAdminRole(context);
    const householdId = requireHouseholdId(context);
    const createdBy = requireUserOrKeyOwner(context);
    const input = await readJsonBody(request, createInviteInputSchema);
    const invite = await new InviteService(getDatabase()).createInvite(householdId, input, {
      userId: createdBy,
      role: context.membershipRole ?? "admin",
    });
    const origin = resolveOrigin(await headers());
    return createdResponse(
      { ...invite, url: inviteUrl(origin, invite.token) },
      `/api/v1/households/invites/${invite.id}`
    );
  } catch (error) {
    return handleApiError(error, request.url);
  }
}
