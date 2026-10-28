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

/** Print PDF limits, same idea: product config the pipeline never reads. */
export const PDF_LIMITS = {
  maxConcurrentJobs: 2,
  maxPdfsPerMonth: 60,
};

export type PdfLimits = typeof PDF_LIMITS;

export function checkPdfLimits(
  usage: { activeJobs: number; jobsThisMonth: number },
  limits: PdfLimits = PDF_LIMITS
): { ok: true } | { ok: false; message: string } {
  if (usage.activeJobs >= limits.maxConcurrentJobs) {
    return { ok: false, message: "A PDF is already being made. Try again when it finishes." };
  }
  if (usage.jobsThisMonth >= limits.maxPdfsPerMonth) {
    return {
      ok: false,
      message: `You've made ${limits.maxPdfsPerMonth} PDFs this month. More open on the 1st.`,
    };
  }
  return { ok: true };
}

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
