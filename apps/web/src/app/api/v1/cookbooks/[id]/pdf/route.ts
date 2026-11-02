import "@/lib/book-pdf-job";
import { NextRequest } from "next/server";
import { z } from "zod";
import { BadRequestError, ForbiddenError, handleApiError, NotFoundError } from "@/lib/api/errors";
import { getRequestContext, requireHouseholdId } from "@/lib/api/middleware";
import { readJsonBody } from "@/lib/api/read-json";
import { jsonResponse } from "@/lib/api/response";
import { pdfView, startBookPdf } from "@/lib/book-pdf-view";
import { printCookbookId } from "@/lib/book-print";
import { DEMO_PDF_OFF, isDemoModeEnabled } from "@/lib/demo/mode";
import { isBooksEnabled, jobQueue, kickFromRequest } from "@/lib/jobs";

const body = z.object({ mode: z.enum(["home", "shop"]) });

/** Chromium fallback when the HTTP worker kick cannot pass preview SSO. */
export const maxDuration = 180;

/** Starts the print PDF for this cookbook, or hands back the one already made for these pages. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!isBooksEnabled()) throw new NotFoundError("Route");
    if (isDemoModeEnabled()) throw new ForbiddenError(DEMO_PDF_OFF);
    const context = await getRequestContext(request);
    const householdId = requireHouseholdId(context);
    const id = printCookbookId((await params).id);
    const { mode } = await readJsonBody(request, body);
    const queue = jobQueue();

    const started = await startBookPdf(queue, {
      cookbookId: id,
      householdId,
      mode,
      origin: request.nextUrl.origin,
    });
    if (!started) throw new NotFoundError("Cookbook", id);
    if ("refused" in started) {
      await kickFromRequest(request);
      throw new BadRequestError(started.refused);
    }
    // Resume a live job and start a new one the same way: a lost chain needs
    // another kick, otherwise the sheet polls "0 of N" until the daily sweep.
    await kickFromRequest(request);

    const job = await queue.get(started.jobId);
    return jsonResponse(pdfView(job, await queue.items(started.jobId)), 202);
  } catch (error) {
    return handleApiError(error, request.url);
  }
}
