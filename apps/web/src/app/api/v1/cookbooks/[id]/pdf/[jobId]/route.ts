import { NextRequest } from "next/server";
import { handleApiError } from "@/lib/api/errors";
import { getRequestContext, requireHouseholdId } from "@/lib/api/middleware";
import { jsonResponse } from "@/lib/api/response";
import { loadPdfJob, pdfView } from "@/lib/book-pdf-view";
import { jobQueue } from "@/lib/jobs";

type Params = { params: Promise<{ id: string; jobId: string }> };

/** Progress for the Print sheet: chunks done of total, then the download link. */
export async function GET(request: NextRequest, { params }: Params) {
  try {
    const context = await getRequestContext(request);
    const householdId = requireHouseholdId(context);
    const { id, jobId } = await params;
    const queue = jobQueue();
    const job = await loadPdfJob(queue, id, jobId, householdId);
    return jsonResponse(pdfView(job, await queue.items(jobId)));
  } catch (error) {
    return handleApiError(error, request.url);
  }
}
