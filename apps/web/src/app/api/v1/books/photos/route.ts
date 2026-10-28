import { NextRequest } from "next/server";
import { randomBytes } from "node:crypto";
import { AI_GATEWAY_MISSING_MESSAGE, isAiGatewayConfigured } from "@ovenlovin/core/onboarding";
import { planBookImport } from "@ovenlovin/core/jobs";
import { z } from "zod";
import { BadRequestError, ForbiddenError, handleApiError, NotFoundError } from "@/lib/api/errors";
import { getRequestContext, requireWritableHousehold } from "@/lib/api/middleware";
import { readJsonBody } from "@/lib/api/read-json";
import { createdResponse, jsonResponse } from "@/lib/api/response";
import { createShotBook, mapPhotoContents } from "@/lib/book-shot-view";
import { isDemoModeEnabled } from "@/lib/demo/mode";
import { isBooksEnabled, jobQueue } from "@/lib/jobs";

export const runtime = "nodejs";
export const maxDuration = 60;

const body = z.object({
  name: z.string().trim().min(1).max(200),
  /** Contents or index page photos, in order. */
  images: z.array(z.string().min(1)).min(1).max(6),
});

/**
 * Photographs of a paper cookbook's contents or index pages: read them, build
 * the same contents map as a PDF gets, and start a book job around it. No
 * file is stored, so there is no blob, no queue step, and no upload meter.
 */
export async function POST(request: NextRequest) {
  try {
    if (!isBooksEnabled()) throw new NotFoundError("Route");
    if (isDemoModeEnabled()) {
      throw new ForbiddenError("Book uploads are turned off in the public demo.");
    }
    if (!isAiGatewayConfigured(process.env)) {
      throw new BadRequestError(AI_GATEWAY_MISSING_MESSAGE);
    }
    const context = await getRequestContext(request);
    const householdId = requireWritableHousehold(context);
    const input = await readJsonBody(request, body);
    const queue = jobQueue();
    const sha256 = randomBytes(32).toString("hex");
    const usage = await queue.usage(householdId, "book_import");
    const plan = planBookImport({ sha256, bytes: 0, pages: 0 }, null, usage);
    if (plan.action === "refuse") throw new BadRequestError(plan.message, { breach: plan.breach });
    const map = await mapPhotoContents(input.images);
    if (map.candidates.length === 0) {
      throw new BadRequestError(
        "We could not read any recipes from those photos. Try retaking them in good light."
      );
    }
    const jobId = await createShotBook(queue, householdId, {
      name: input.name,
      sha256,
      map,
    });
    return createdResponse({ jobId, map }, `/api/v1/books/imports/${jobId}`);
  } catch (error) {
    return handleApiError(error, request.url);
  }
}
