/**
 * Book import limits are product config, not pipeline limits. Raising one
 * (or drawing a paid tier) changes only these numbers or the overrides passed in.
 */
export const BOOK_LIMITS = {
  maxPages: 600,
  maxBytes: 500 * 1024 * 1024,
  maxConcurrentJobs: 2,
  maxBooksPerMonth: 10,
};

export type BookLimits = typeof BOOK_LIMITS;

export type BookLimitBreach = "pages" | "bytes" | "concurrency" | "monthly";

export type BookRequest = {
  pages?: number;
  bytes?: number;
  activeJobs: number;
  jobsThisMonth: number;
};

export function bookLimits(overrides: Partial<BookLimits> = {}): BookLimits {
  return { ...BOOK_LIMITS, ...overrides };
}

export function checkBookLimits(
  request: BookRequest,
  limits: BookLimits = BOOK_LIMITS
): { ok: true } | { ok: false; breach: BookLimitBreach; limit: number } {
  if ((request.pages ?? 0) > limits.maxPages) {
    return { ok: false, breach: "pages", limit: limits.maxPages };
  }
  if ((request.bytes ?? 0) > limits.maxBytes) {
    return { ok: false, breach: "bytes", limit: limits.maxBytes };
  }
  if (request.activeJobs >= limits.maxConcurrentJobs) {
    return { ok: false, breach: "concurrency", limit: limits.maxConcurrentJobs };
  }
  if (request.jobsThisMonth >= limits.maxBooksPerMonth) {
    return { ok: false, breach: "monthly", limit: limits.maxBooksPerMonth };
  }
  return { ok: true };
}
