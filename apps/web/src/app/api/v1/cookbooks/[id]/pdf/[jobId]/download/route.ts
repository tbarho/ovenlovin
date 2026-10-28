import { NextRequest, NextResponse } from "next/server";
import { handleApiError, NotFoundError } from "@/lib/api/errors";
import { getRequestContext, requireHouseholdId } from "@/lib/api/middleware";
import { loadPdfJob, pdfFileName, type BookPdfInput } from "@/lib/book-pdf-view";
import { jobQueue } from "@/lib/jobs";
import { isLocalPdf, pdfStore } from "@/lib/pdf-store";

type Params = { params: Promise<{ id: string; jobId: string }> };

/** The finished PDF. Blob serves it straight; the local store (dev, e2e) streams from disk. */
export async function GET(request: NextRequest, { params }: Params) {
  try {
    const context = await getRequestContext(request);
    const householdId = requireHouseholdId(context);
    const { id, jobId } = await params;
    const job = await loadPdfJob(jobQueue(), id, jobId, householdId);
    const input = job.input as BookPdfInput;
    if (!input.pdf) throw new NotFoundError("PDF", jobId);
    if (!isLocalPdf(input.pdf.url)) {
      return NextResponse.redirect(input.pdf.downloadUrl ?? input.pdf.url, 302);
    }
    const bytes = await pdfStore().read(input.pdf.url);
    return new NextResponse(Buffer.from(bytes), {
      headers: {
        "content-type": "application/pdf",
        "content-length": String(bytes.length),
        "content-disposition": `attachment; filename="${pdfFileName(input)}"`,
      },
    });
  } catch (error) {
    return handleApiError(error, request.url);
  }
}
