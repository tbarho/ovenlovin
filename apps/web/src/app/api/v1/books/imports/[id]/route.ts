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
import { loadBookContents, startRecipeExtraction } from "@/lib/book-import-view";
import { loadBookShotList } from "@/lib/book-shot-view";
import { isBooksEnabled, jobQueue, kickWorker } from "@/lib/jobs";

const body = z.object({ picks: z.array(z.string().max(200)).max(5000) });

type Params = { params: Promise<{ id: string }> };

const load = async (id: string, householdId: string) => {
  if (!isBooksEnabled()) throw new NotFoundError("Route");
  if (!z.string().uuid().safeParse(id).success) throw new NotFoundError("Book import", id);
  const view = await loadBookContents(jobQueue(), id, householdId);
  if (!view) throw new NotFoundError("Book import", id);
  return view;
};

/** Paper books (contents read from photos) serve their shot list instead. */
const loadShot = async (id: string, householdId: string) => {
  if (!isBooksEnabled() || !z.string().uuid().safeParse(id).success) return null;
  return loadBookShotList(jobQueue(), id, householdId);
};

/** The contents map for one uploaded book, with the household's picks. */
export async function GET(request: NextRequest, { params }: Params) {
  try {
    const context = await getRequestContext(request);
    const householdId = requireHouseholdId(context);
    const { id } = await params;
    const shot = await loadShot(id, householdId);
    return jsonResponse(shot ?? (await load(id, householdId)));
  } catch (error) {
    return handleApiError(error, request.url);
  }
}

/** Saves which recipes to pull from the book. Ids not on the map are dropped. */
export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const context = await getRequestContext(request);
    const { id } = await params;
    const householdId = requireWritableHousehold(context);
    const shot = await loadShot(id, householdId);
    if (shot) {
      if (!shot.map) throw new BadRequestError("The contents are still being read. Try again soon.");
      const input = await readJsonBody(request, body);
      const picks = resolvePicks(shot.map.candidates, input.picks);
      await jobQueue().patchInput(id, { picks });
      return jsonResponse({ ...shot, picks });
    }
    const view = await load(id, householdId);
    if (!view.map) throw new BadRequestError("The contents are still being read. Try again soon.");
    const input = await readJsonBody(request, body);
    const picks = resolvePicks(view.map.candidates, input.picks);
    await jobQueue().patchInput(id, { picks });
    return jsonResponse({ ...view, picks });
  } catch (error) {
    return handleApiError(error, request.url);
  }
}

/**
 * Confirms the picks. A PDF book starts pulling each picked recipe on the job
 * worker, so closing the tab does not stop it. A paper book just puts the
 * shot list out: each recipe waits for its page photos.
 */
export async function POST(request: NextRequest, { params }: Params) {
  try {
    const context = await getRequestContext(request);
    const { id } = await params;
    const householdId = requireWritableHousehold(context);
    const shot = await loadShot(id, householdId);
    if (shot) {
      if (!shot.map) throw new BadRequestError("The contents are still being read. Try again soon.");
      if (shot.picks.length === 0) throw new BadRequestError("Pick at least one recipe first.");
      await jobQueue().patchInput(id, { shooting: true });
      return jsonResponse({ started: true, view: { ...shot } }, 202);
    }
    const view = await load(id, householdId);
    if (!view.map) throw new BadRequestError("The contents are still being read. Try again soon.");
    if (view.picks.length === 0) throw new BadRequestError("Pick at least one recipe first.");
    const started = await startRecipeExtraction(jobQueue(), id, householdId);
    if (started?.added) await kickWorker(request.nextUrl.origin);
    return jsonResponse(started, 202);
  } catch (error) {
    return handleApiError(error, request.url);
  }
}
