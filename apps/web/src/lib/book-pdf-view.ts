import { printChunks, type PrintMode } from "@ovenlovin/core/book";
import { checkPdfLimits, type JobQueue } from "@ovenlovin/core/jobs";
import { z } from "zod";
import { NotFoundError } from "@/lib/api/errors";
import type { LowRes } from "@/lib/book-pdf-types";
import { bookFingerprint, loadPrintBook } from "@/lib/book-print";
import { isBooksEnabled } from "@/lib/jobs";

/** Request-side half of the print PDF. The renderer (Chromium, pdf-lib) stays in book-pdf-job. */
export type BookPdfInput = {
  cookbookId: string;
  mode: PrintMode;
  title: string;
  sha256: string;
  pageCount: number;
  chunks: { from: number; to: number }[];
  origin: string;
  pdf?: { url: string; downloadUrl: string | null; bytes: number; lowRes: LowRes[] } | null;
};

const slug = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60) || "cookbook";

export const pdfFileName = (input: BookPdfInput) =>
  `${slug(input.title)}-${input.mode === "shop" ? "print-shop" : "home"}.pdf`;

/** A book_pdf job of this household's cookbook, or 404. */
export async function loadPdfJob(
  queue: JobQueue,
  cookbookId: string,
  jobId: string,
  householdId: string
) {
  if (!isBooksEnabled() || !z.string().uuid().safeParse(jobId).success) {
    throw new NotFoundError("PDF", jobId);
  }
  const job = await queue.get(jobId);
  const owned =
    job?.householdId === householdId &&
    job.kind === "book_pdf" &&
    (job.input as BookPdfInput).cookbookId === cookbookId;
  if (!owned) throw new NotFoundError("PDF", jobId);
  return job;
}

function statusOf(job: any, failed: boolean) {
  if ((job.input as BookPdfInput).pdf) return "ready";
  if (failed || job.status === "failed") return "failed";
  if (job.status === "done") return "expired";
  return "running";
}

/** What the Print sheet shows for one job: chunks done of total, then the download. */
export function pdfView(job: any, items: any[]) {
  const input = job.input as BookPdfInput;
  const failed = items.find((item) => item.status === "failed");
  const status = statusOf(job, Boolean(failed));
  const total = input.chunks.length + 1;
  const done = items.filter((item) => item.status === "done").length;
  return {
    jobId: job.id as string,
    cookbookId: input.cookbookId,
    mode: input.mode,
    status,
    done: status === "ready" ? total : done,
    total,
    pages: input.pageCount,
    bytes: input.pdf?.bytes ?? null,
    lowRes: input.pdf?.lowRes ?? [],
    downloadUrl:
      status === "ready" ? `/api/v1/cookbooks/${input.cookbookId}/pdf/${job.id}/download` : null,
    error: status === "failed" ? (failed?.error ?? "The PDF could not be made.") : null,
  };
}

/**
 * Starts (or resumes) the PDF for this book as it is right now. The same
 * pages in the same mode reuse the job already made, so a second tap is free.
 */
export async function startBookPdf(
  queue: JobQueue,
  {
    cookbookId,
    householdId,
    mode,
    origin,
  }: { cookbookId: string; householdId: string; mode: PrintMode; origin: string }
) {
  const book = await loadPrintBook(cookbookId, householdId);
  if (!book) return null;
  if (!book.pages.length) return { refused: "This book has no recipes yet." };

  const sha256 = bookFingerprint(book.id, mode, book.pages);
  const existing = await queue.findBySha(householdId, "book_pdf", sha256);
  const found = existing ? await queue.get(existing) : null;
  if (found && (found.status !== "done" || (found.input as BookPdfInput).pdf)) {
    return { jobId: found.id as string, started: false };
  }

  const limits = checkPdfLimits(await queue.usage(householdId, "book_pdf"));
  if (!limits.ok) return { refused: limits.message };

  const input: BookPdfInput = {
    cookbookId,
    mode,
    title: book.title,
    sha256,
    pageCount: book.pages.length,
    chunks: printChunks(book.pages),
    origin,
  };
  const jobId = await queue.enqueue(householdId, "book_pdf", input, [
    { step: "chunk", index: 0, key: "chunk-0" },
  ]);
  return { jobId, started: true };
}
