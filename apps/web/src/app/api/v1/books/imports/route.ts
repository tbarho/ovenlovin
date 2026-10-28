import { NextRequest } from "next/server";
import { del } from "@vercel/blob";
import { planBookImport, type BookImportInput } from "@ovenlovin/core/jobs";
import { z } from "zod";
import { BadRequestError, ForbiddenError, handleApiError, NotFoundError } from "@/lib/api/errors";
import { getRequestContext, requireWritableHousehold } from "@/lib/api/middleware";
import { readJsonBody } from "@/lib/api/read-json";
import { createdResponse, jsonResponse } from "@/lib/api/response";
import { bookUploadPath, countPdfPages, isBookBlobUrl, sha256Hex } from "@/lib/book-import";
import { isDemoModeEnabled } from "@/lib/demo/mode";
import { isBooksEnabled, jobQueue } from "@/lib/jobs";

const body = z.object({
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
  bytes: z.number().int().positive(),
  name: z.string().trim().min(1).max(200),
  blobUrl: z.string().url().max(2048).optional(),
});

async function download(url: string) {
  const response = await fetch(url);
  if (!response.ok) throw new BadRequestError("We could not find that upload. Try again.");
  return new Uint8Array(await response.arrayBuffer());
}

/**
 * Two calls, one route. Without blobUrl it is the preflight: resume a known
 * file, refuse over-limit, or hand back the upload path. With blobUrl the file
 * is already in Blob: verify it, count pages, check limits again, create the job.
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
      if (duplicate) await del(input.blobUrl!).catch(() => undefined);
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
      });
    }

    if (!isBookBlobUrl(input.blobUrl, householdId)) {
      throw new BadRequestError("That upload is not one of yours");
    }
    const file = await download(input.blobUrl);
    const refuse = async (message: string, extensions?: Record<string, unknown>) => {
      await del(input.blobUrl!).catch(() => undefined);
      return new BadRequestError(message, extensions);
    };
    if (sha256Hex(file) !== input.sha256) {
      throw await refuse("That upload did not match your file. Try again.");
    }
    const pages = countPdfPages(file);
    if (pages === 0) {
      throw await refuse("We could not read this PDF. Try exporting or printing it to PDF again.");
    }

    const plan = planBookImport({ ...input, bytes: file.byteLength, pages }, null, usage);
    if (plan.action === "refuse") throw await refuse(plan.message, { breach: plan.breach });

    const jobInput: BookImportInput = {
      blobUrl: input.blobUrl,
      sha256: input.sha256,
      bytes: file.byteLength,
      pages,
      name: input.name,
    };
    const jobId = await queue.enqueue(householdId, "book_import", jobInput);
    return createdResponse({ status: "started", jobId, pages });
  } catch (error) {
    return handleApiError(error, request.url);
  }
}
