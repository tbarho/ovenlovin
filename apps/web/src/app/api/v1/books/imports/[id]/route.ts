import { NextRequest } from "next/server";
import { resolvePicks } from "@ovenlovin/core/jobs";
import { z } from "zod";
import { BadRequestError, handleApiError, NotFoundError } from "@/lib/api/errors";
import {
  getRequestContext,
  requireHouseholdId,
  requireWritableHousehold,
} from "@/lib/api/middleware";
import { readJsonBody } from "@/lib/api/read-json";
import { jsonResponse } from "@/lib/api/response";
import { loadBookContents } from "@/lib/book-import-view";
import { isBooksEnabled, jobQueue } from "@/lib/jobs";

const body = z.object({ picks: z.array(z.string().max(200)).max(5000) });

type Params = { params: Promise<{ id: string }> };

const load = async (id: string, householdId: string) => {
  if (!isBooksEnabled()) throw new NotFoundError("Route");
  if (!z.string().uuid().safeParse(id).success) throw new NotFoundError("Book import", id);
  const view = await loadBookContents(jobQueue(), id, householdId);
  if (!view) throw new NotFoundError("Book import", id);
  return view;
};

/** The contents map for one uploaded book, with the household's picks. */
export async function GET(request: NextRequest, { params }: Params) {
  try {
    const context = await getRequestContext(request);
    const view = await load((await params).id, requireHouseholdId(context));
    return jsonResponse(view);
  } catch (error) {
    return handleApiError(error, request.url);
  }
}

/** Saves which recipes to pull from the book. Ids not on the map are dropped. */
export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const context = await getRequestContext(request);
    const { id } = await params;
    const view = await load(id, requireWritableHousehold(context));
    if (!view.map) throw new BadRequestError("The contents are still being read. Try again soon.");
    const input = await readJsonBody(request, body);
    const picks = resolvePicks(view.map.candidates, input.picks);
    await jobQueue().patchInput(id, { picks });
    return jsonResponse({ ...view, picks });
  } catch (error) {
    return handleApiError(error, request.url);
  }
}
