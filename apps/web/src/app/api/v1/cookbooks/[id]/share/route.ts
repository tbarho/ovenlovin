import { NextRequest } from "next/server";
import { CookbookShareService, ShareBlockedError } from "@ovenlovin/core";
import { getDatabase } from "@ovenlovin/db";
import { ConflictError, handleApiError, NotFoundError } from "@/lib/api/errors";
import { loadOwnedCookbook } from "@/lib/api/cookbooks";
import {
  getRequestContext,
  requireHouseholdId,
  requireUserOrKeyOwner,
  requireWritableHousehold,
} from "@/lib/api/middleware";
import { jsonResponse, noContentResponse } from "@/lib/api/response";
import { presentShare } from "@/lib/cookbook-share";
import { isBooksEnabled } from "@/lib/jobs";

type Params = { params: Promise<{ id: string }> };

const shares = () => new CookbookShareService(getDatabase());

/** The cookbook's unlisted reader link, if any, and why it cannot have one. */
export async function GET(request: NextRequest, { params }: Params) {
  try {
    if (!isBooksEnabled()) throw new NotFoundError("Route");
    const context = await getRequestContext(request);
    const { id } = await params;
    await loadOwnedCookbook(id, requireHouseholdId(context));
    return jsonResponse(presentShare(await shares().getStatus(id)));
  } catch (error) {
    return handleApiError(error, request.url);
  }
}

/** Makes the link (or returns the live one). 409 when the cookbook holds published-book recipes. */
export async function POST(request: NextRequest, { params }: Params) {
  try {
    if (!isBooksEnabled()) throw new NotFoundError("Route");
    const context = await getRequestContext(request);
    const { id } = await params;
    await loadOwnedCookbook(id, requireWritableHousehold(context));
    const status = await shares().createLink(id, requireUserOrKeyOwner(context));
    return jsonResponse(presentShare(status), 201);
  } catch (error) {
    if (error instanceof ShareBlockedError) {
      return handleApiError(new ConflictError(error.message, { code: error.code }), request.url);
    }
    return handleApiError(error, request.url);
  }
}

/** Revokes the link. The old URL 404s from then on. */
export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    if (!isBooksEnabled()) throw new NotFoundError("Route");
    const context = await getRequestContext(request);
    const { id } = await params;
    await loadOwnedCookbook(id, requireWritableHousehold(context));
    await shares().revokeLink(id);
    return noContentResponse();
  } catch (error) {
    return handleApiError(error, request.url);
  }
}
