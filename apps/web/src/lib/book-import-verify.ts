import { createHash } from "node:crypto";
import { open, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  BOOK_LIMITS,
  PermanentJobError,
  bookLimitMessage,
  type BookImportInput,
  type ClaimedItem,
  type JobQueue,
} from "@ovenlovin/core/jobs";
import {
  countPdfPagesOnDisk,
  isBookBlobUrl,
  PasswordProtectedPdfError,
  UnreadablePdfError,
} from "@/lib/book-import";
import { deleteBookBlobs, fetchBookBlob } from "@/lib/books-blob";

/** Streams a book blob (public or private) to disk while hashing it. */
export async function streamToTemp(url: string, path: string) {
  const response = await fetchBookBlob(url);
  if (!response.ok || !response.body) {
    if (response.status === 404 || response.status === 403) {
      throw new PermanentJobError("We could not find that upload. Try again.");
    }
    throw new Error(`Blob download failed (${response.status})`);
  }
  const hash = createHash("sha256");
  let bytes = 0;
  const file = await open(path, "w");
  const reader = response.body.getReader();
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = Buffer.from(value);
      hash.update(chunk);
      bytes += chunk.length;
      await file.write(chunk);
    }
  } catch (error) {
    await reader.cancel().catch(() => undefined);
    throw error;
  } finally {
    await file.close();
  }
  return { sha256: hash.digest("hex"), bytes };
}

/**
 * First book_import item: stream the PDF to /tmp while hashing, confirm SHA-256,
 * count pages without trusting a loose tail /Count, enforce the page cap,
 * then mark the job verified. Heavy work stays off the upload request path.
 */
export async function verifyBookImport(queue: JobQueue, item: ClaimedItem) {
  const job = await queue.get(item.jobId);
  if (!job) throw new PermanentJobError("Job missing");
  const input = job.input as BookImportInput;
  if (!input?.blobUrl || !isBookBlobUrl(input.blobUrl, item.householdId)) {
    throw new PermanentJobError("That upload is not one of yours");
  }

  const path = join(tmpdir(), `ovenlovin-book-${item.jobId}.pdf`);
  try {
    const streamed = await streamToTemp(input.blobUrl, path);
    if (streamed.sha256 !== input.sha256) {
      await deleteBookBlobs([input.blobUrl]).catch(() => undefined);
      throw new PermanentJobError("That upload did not match your file. Try again.");
    }

    let pages = 0;
    try {
      pages = await countPdfPagesOnDisk(path);
    } catch (error) {
      if (error instanceof PasswordProtectedPdfError) {
        await deleteBookBlobs([input.blobUrl]).catch(() => undefined);
        throw new PermanentJobError(error.message);
      }
      if (error instanceof UnreadablePdfError) {
        // Keep the blob for a later sweep; the file may be recoverable.
        throw new PermanentJobError(error.message);
      }
      throw error;
    }
    if (pages === 0) {
      await deleteBookBlobs([input.blobUrl]).catch(() => undefined);
      throw new PermanentJobError(
        "We could not read this PDF's page count. Try exporting or printing it to PDF again."
      );
    }
    if (pages > BOOK_LIMITS.maxPages) {
      await deleteBookBlobs([input.blobUrl]).catch(() => undefined);
      throw new PermanentJobError(bookLimitMessage("pages", BOOK_LIMITS.maxPages));
    }

    await queue.patchInput(item.jobId, {
      pages,
      bytes: streamed.bytes,
      verified: true,
    });
    const items = await queue.items(item.jobId);
    if (!items.some((existing: any) => existing.payload?.step === "contents")) {
      await queue.addItems(item.jobId, [{ step: "contents" }]);
    }
    return { pages, bytes: streamed.bytes };
  } finally {
    await unlink(path).catch(() => undefined);
  }
}
