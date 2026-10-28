import { createHash } from "node:crypto";
import { open, readFile, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { del } from "@vercel/blob";
import {
  BOOK_LIMITS,
  PermanentJobError,
  bookLimitMessage,
  type BookImportInput,
  type ClaimedItem,
  type JobQueue,
} from "@ovenlovin/core/jobs";
import { countPdfPages, isBookBlobUrl } from "@/lib/book-import";

async function streamToTemp(url: string, path: string) {
  const response = await fetch(url);
  if (!response.ok || !response.body) {
    throw new PermanentJobError("We could not find that upload. Try again.");
  }
  const hash = createHash("sha256");
  let bytes = 0;
  const file = await open(path, "w");
  try {
    const reader = response.body.getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = Buffer.from(value);
      hash.update(chunk);
      bytes += chunk.length;
      await file.write(chunk);
    }
  } finally {
    await file.close();
  }
  return { sha256: hash.digest("hex"), bytes };
}

/** Prefer /Count from the trailing window so we avoid a second full parse when possible. */
function countFromTail(tail: Buffer) {
  const text = tail.toString("latin1");
  const pagesNodes = [...text.matchAll(/\/Type\s*\/Pages\b[\s\S]{0,400}?\/Count\s+(\d+)/g)];
  if (pagesNodes.length === 0) return 0;
  return Math.max(...pagesNodes.map((match) => Number(match[1] ?? 0)));
}

async function countPagesOnDisk(path: string) {
  const file = await open(path, "r");
  try {
    const size = (await file.stat()).size;
    const tailSize = Math.min(size, 512 * 1024);
    const tail = Buffer.alloc(tailSize);
    await file.read(tail, 0, tailSize, size - tailSize);
    const fromTail = countFromTail(tail);
    if (fromTail > 0) return fromTail;
  } finally {
    await file.close();
  }
  return countPdfPages(await readFile(path));
}

/**
 * First book_import item: stream the PDF to /tmp while hashing, confirm SHA-256,
 * count pages (tail /Count first, full parse as fallback), enforce the page cap,
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
      await del(input.blobUrl).catch(() => undefined);
      throw new PermanentJobError("That upload did not match your file. Try again.");
    }

    const pages = await countPagesOnDisk(path);
    if (pages === 0) {
      await del(input.blobUrl).catch(() => undefined);
      throw new PermanentJobError(
        "We could not read this PDF. Try exporting or printing it to PDF again."
      );
    }
    if (pages > BOOK_LIMITS.maxPages) {
      await del(input.blobUrl).catch(() => undefined);
      throw new PermanentJobError(bookLimitMessage("pages", BOOK_LIMITS.maxPages));
    }

    await queue.patchInput(item.jobId, {
      pages,
      bytes: streamed.bytes,
      verified: true,
    });
    return { pages, bytes: streamed.bytes };
  } finally {
    await unlink(path).catch(() => undefined);
  }
}
