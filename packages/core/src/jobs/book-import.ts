import {
  checkBookLimits,
  BOOK_LIMITS,
  type BookLimitBreach,
  type BookLimits,
} from "./entitlements";

export type BookImportInput = {
  blobUrl: string;
  sha256: string;
  bytes: number;
  pages: number;
  name: string;
  verified?: boolean;
};

export type BookImportRequest = {
  sha256: string;
  bytes: number;
  pages?: number;
};

export type BookImportPlan =
  | { action: "resume"; jobId: string }
  | { action: "refuse"; breach: BookLimitBreach; message: string }
  | { action: "start" };

const megabytes = (bytes: number) => Math.round(bytes / (1024 * 1024));

export function bookLimitMessage(breach: BookLimitBreach, limit: number) {
  if (breach === "pages") {
    return `This book has more than ${limit} pages. Books can have up to ${limit} pages for now.`;
  }
  if (breach === "bytes") {
    return `This file is bigger than ${megabytes(limit)} MB. Try a smaller copy of the book.`;
  }
  if (breach === "concurrency") {
    return `You already have ${limit} books being read. Add this one when one of them finishes.`;
  }
  return `You have added ${limit} books this month. You can add more next month.`;
}

/**
 * Decides what a whole-cookbook upload does. The same file (by SHA-256) picks
 * up its existing job before any limit applies, so re-adding a book never
 * costs a monthly slot or trips the concurrency cap.
 */
export function planBookImport(
  request: BookImportRequest,
  existingJobId: string | null,
  usage: { activeJobs: number; jobsThisMonth: number },
  limits: BookLimits = BOOK_LIMITS
): BookImportPlan {
  if (existingJobId) return { action: "resume", jobId: existingJobId };

  const check = checkBookLimits({ ...usage, bytes: request.bytes, pages: request.pages }, limits);
  if (!check.ok) {
    return {
      action: "refuse",
      breach: check.breach,
      message: bookLimitMessage(check.breach, check.limit),
    };
  }
  return { action: "start" };
}
