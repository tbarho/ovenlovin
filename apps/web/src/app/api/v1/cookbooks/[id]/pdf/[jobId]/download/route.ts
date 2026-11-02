import { NextRequest, NextResponse } from "next/server";
import { handleApiError, NotFoundError } from "@/lib/api/errors";
import { getRequestContext, requireHouseholdId } from "@/lib/api/middleware";
import { loadPdfJob, pdfFileName, type BookPdfInput } from "@/lib/book-pdf-view";
import { jobQueue } from "@/lib/jobs";
import { isPrivateBlobUrl } from "@/lib/books-blob";
import { isLocalPdf, openPdf } from "@/lib/pdf-store";

type Params = { params: Promise<{ id: string; jobId: string }> };

/**
 * The finished PDF. A private-store PDF (BOOKS_BLOB_PRIVATE_READ_WRITE_TOKEN)
 * or a local disk one (dev, e2e) streams through this authed route, so its
 * URL never reaches the browser. A legacy public-store PDF still redirects as
 * before: big print-shop files must not ride a function response until the
 * private store is on and a large download is proven on a preview.
 */
export async function GET(request: NextRequest, { params }: Params) {
  try {
    const context = await getRequestContext(request);
    const householdId = requireHouseholdId(context);
    const { id, jobId } = await params;
    const job = await loadPdfJob(jobQueue(), id, jobId, householdId);
    const input = job.input as BookPdfInput;
    if (!input.pdf) throw new NotFoundError("PDF", jobId);
    if (!isLocalPdf(input.pdf.url) && !isPrivateBlobUrl(input.pdf.url)) {
      return NextResponse.redirect(input.pdf.downloadUrl ?? input.pdf.url, 302);
    }
    const file = await openPdf(input.pdf.url);
    return new NextResponse(file.body, {
      headers: {
        "content-type": "application/pdf",
        ...(file.bytes ? { "content-length": String(file.bytes) } : {}),
        "content-disposition": `attachment; filename="${pdfFileName(input)}"`,
        "cache-control": "private, no-store",
      },
    });
  } catch (error) {
    return handleApiError(error, request.url);
  }
}
