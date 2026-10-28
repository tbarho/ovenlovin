import { NextRequest } from "next/server";
import { z } from "zod";
import { BadRequestError, handleApiError, NotFoundError } from "@/lib/api/errors";
import { getRequestContext, requireWritableHousehold } from "@/lib/api/middleware";
import { readJsonBody } from "@/lib/api/read-json";
import { jsonResponse } from "@/lib/api/response";
import { loadBookContents } from "@/lib/book-import-view";
import { loadBookShotList } from "@/lib/book-shot-view";
import { saveBookRecipes } from "@/lib/book-save";
import { isBooksEnabled, jobQueue } from "@/lib/jobs";

const body = z.object({
  items: z
    .array(z.object({ candidateId: z.string().max(200), reviewed: z.unknown().optional() }))
    .min(1)
    .max(5000),
});

type Params = { params: Promise<{ id: string }> };

/**
 * Saves picked recipes into the book's cookbook. Items without `reviewed` must
 * be Ready; `reviewed` carries the person's edits for one that needed a look.
 * Returns the refreshed book view.
 */
export async function POST(request: NextRequest, { params }: Params) {
  try {
    if (!isBooksEnabled()) throw new NotFoundError("Route");
    const context = await getRequestContext(request);
    const { id } = await params;
    if (!z.string().uuid().safeParse(id).success) throw new NotFoundError("Book import", id);
    const householdId = requireWritableHousehold(context);
    const createdBy = context.userId || context.clientId;
    if (!createdBy) throw new BadRequestError("No user to save these recipes as");
    const input = await readJsonBody(request, body);
    const result = await saveBookRecipes(jobQueue(), id, { householdId, createdBy }, input.items);
    if (!result) throw new NotFoundError("Book import", id);
    const view =
      (await loadBookShotList(jobQueue(), id, householdId)) ??
      (await loadBookContents(jobQueue(), id, householdId));
    return jsonResponse({ ...result, view });
  } catch (error) {
    return handleApiError(error, request.url);
  }
}
