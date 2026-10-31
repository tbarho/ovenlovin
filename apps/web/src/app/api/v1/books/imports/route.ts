import { NextRequest } from "next/server";
import { planBookImport, type BookImportInput } from "@ovenlovin/core/jobs";
import { z } from "zod";
import { BadRequestError, ForbiddenError, handleApiError, NotFoundError } from "@/lib/api/errors";
import { getRequestContext, requireWritableHousehold } from "@/lib/api/middleware";
import { readJsonBody } from "@/lib/api/read-json";
import { createdResponse, jsonResponse } from "@/lib/api/response";
import { bookUploadPath, isBookBlobUrl } from "@/lib/book-import";
import { bookBlobAccess, deleteBookBlobs } from "@/lib/books-blob";
import { isDemoModeEnabled } from "@/lib/demo/mode";
import { isBooksEnabled, jobQueue, kickWorker } from "@/lib/jobs";

const body = z.object({
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
  bytes: z.number().int().positive(),
  name: z.string().trim().min(1).max(200),
  blobUrl: z.string().url().max(2048).optional(),
});

/**
 * Two calls, one route. Without blobUrl it is the preflight: resume a known
 * file, refuse over-limit, or hand back the upload path. With blobUrl the file
 * is already in Blob: pin the URL, check size/concurrency caps, create the job.
 * SHA and page count run in the worker so this request stays cheap.
 */
export async function POST(request: NextRequest) {
  try {
    if (!isBooksEnabled()) throw new NotFoundError("Route");
    if (isDemoModeEnabled()) {
      throw new ForbiddenError("Book uploads are turned off in the public demo.");
    }
    const context = await getRequestContext(request);
    const householdId = requireWritableHousehold(context);
    const input = await readJsonBody(request, body);
    const queue = jobQueue();

    const existing = await queue.findBySha(householdId, "book_import", input.sha256);
    if (existing) {
      const found = (await queue.get(existing))?.input as BookImportInput | undefined;
      const duplicate =
        input.blobUrl &&
        input.blobUrl !== found?.blobUrl &&
        isBookBlobUrl(input.blobUrl, householdId);
      if (duplicate) await deleteBookBlobs([input.blobUrl!]).catch(() => undefined);
      return jsonResponse({ status: "resumed", jobId: existing, pages: found?.pages });
    }
    const usage = await queue.usage(householdId, "book_import");

    if (!input.blobUrl) {
      const plan = planBookImport(input, null, usage);
      if (plan.action === "refuse")
        throw new BadRequestError(plan.message, { breach: plan.breach });
      return jsonResponse({
        status: "upload",
        pathname: bookUploadPath(householdId, input.sha256),
        access: bookBlobAccess().access,
      });
    }

    if (!isBookBlobUrl(input.blobUrl, householdId)) {
      throw new BadRequestError("That upload is not one of yours");
    }

    // Pages are unknown until the worker verifies. Size and concurrency still apply.
    const plan = planBookImport({ ...input, pages: undefined }, null, usage);
    if (plan.action === "refuse") {
      await deleteBookBlobs([input.blobUrl]).catch(() => undefined);
      throw new BadRequestError(plan.message, { breach: plan.breach });
    }

    const jobInput: BookImportInput = {
      blobUrl: input.blobUrl,
      sha256: input.sha256,
      bytes: input.bytes,
      pages: 0,
      name: input.name,
      verified: false,
    };
    const jobId = await queue.enqueue(householdId, "book_import", jobInput, [{ step: "verify" }]);
    await kickWorker(request.nextUrl.origin);
    return createdResponse({ status: "started", jobId });
  } catch (error) {
    return handleApiError(error, request.url);
  }
}
