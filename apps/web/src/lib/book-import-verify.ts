import { del } from "@vercel/blob";
import {
  BOOK_LIMITS,
  bookLimitMessage,
  type BookImportInput,
  type ClaimedItem,
  type JobQueue,
} from "@ovenlovin/core/jobs";
import { countPdfPages, isBookBlobUrl, sha256Hex } from "@/lib/book-import";

/**
 * First book_import item: download from our Blob store, confirm SHA-256, count
 * pages, enforce the page cap, then mark the job verified. Heavy work stays off
 * the upload request path.
 */
export async function verifyBookImport(queue: JobQueue, item: ClaimedItem) {
  const job = await queue.get(item.jobId);
  if (!job) throw new Error("Job missing");
  const input = job.input as BookImportInput;
  if (!input?.blobUrl || !isBookBlobUrl(input.blobUrl, item.householdId)) {
    throw new Error("That upload is not one of yours");
  }

  const response = await fetch(input.blobUrl);
  if (!response.ok) {
    await del(input.blobUrl).catch(() => undefined);
    throw new Error("We could not find that upload. Try again.");
  }
  const file = new Uint8Array(await response.arrayBuffer());
  if (sha256Hex(file) !== input.sha256) {
    await del(input.blobUrl).catch(() => undefined);
    throw new Error("That upload did not match your file. Try again.");
  }
  const pages = countPdfPages(file);
  if (pages === 0) {
    await del(input.blobUrl).catch(() => undefined);
    throw new Error("We could not read this PDF. Try exporting or printing it to PDF again.");
  }
  if (pages > BOOK_LIMITS.maxPages) {
    await del(input.blobUrl).catch(() => undefined);
    throw new Error(bookLimitMessage("pages", BOOK_LIMITS.maxPages));
  }

  await queue.patchInput(item.jobId, {
    pages,
    bytes: file.byteLength,
    verified: true,
  });
  return { pages, bytes: file.byteLength };
}
