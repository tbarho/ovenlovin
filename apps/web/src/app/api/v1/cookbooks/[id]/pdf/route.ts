import { NextRequest } from "next/server";
import { z } from "zod";
import { BadRequestError, ForbiddenError, handleApiError, NotFoundError } from "@/lib/api/errors";
import { getRequestContext, requireHouseholdId } from "@/lib/api/middleware";
import { readJsonBody } from "@/lib/api/read-json";
import { jsonResponse } from "@/lib/api/response";
import { pdfView, startBookPdf } from "@/lib/book-pdf-view";
import { printCookbookId } from "@/lib/book-print";
import { DEMO_PDF_OFF, isDemoModeEnabled } from "@/lib/demo/mode";
import { isBooksEnabled, jobQueue, kickWorker } from "@/lib/jobs";

const body = z.object({ mode: z.enum(["home", "shop"]) });

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
    if ("refused" in started) throw new BadRequestError(started.refused);
    if (started.started) await kickWorker(request.nextUrl.origin);

    const job = await queue.get(started.jobId);
    return jsonResponse(pdfView(job, await queue.items(started.jobId)), 202);
  } catch (error) {
    return handleApiError(error, request.url);
  }
}
