import { describe, expect, it } from "vitest";
import { bookLimitMessage, planBookImport } from "./book-import";
import { bookLimits } from "./entitlements";

const MB = 1024 * 1024;
const fresh = { activeJobs: 0, jobsThisMonth: 0 };
const book = { sha256: "a".repeat(64), bytes: 40 * MB, pages: 320 };

describe("planBookImport", () => {
  it("starts a new job for a new book inside every limit", () => {
    expect(planBookImport(book, null, fresh)).toEqual({ action: "start" });
  });

  it("resumes the existing job when the same file comes back", () => {
    expect(planBookImport(book, "job-1", fresh)).toEqual({ action: "resume", jobId: "job-1" });
  });

  it("resumes even when the household is at its caps", () => {
    expect(planBookImport(book, "job-1", { activeJobs: 2, jobsThisMonth: 10 })).toEqual({
      action: "resume",
      jobId: "job-1",
    });
  });

  it("refuses an oversized file before it uploads", () => {
    expect(planBookImport({ ...book, bytes: 501 * MB, pages: undefined }, null, fresh)).toEqual({
      action: "refuse",
      breach: "bytes",
      message: "This file is bigger than 500 MB. Try a smaller copy of the book.",
    });
  });

  it("refuses a book with too many pages", () => {
    expect(planBookImport({ ...book, pages: 601 }, null, fresh)).toMatchObject({
      action: "refuse",
      breach: "pages",
    });
  });

  it("refuses when the household is at its concurrency or monthly cap", () => {
    expect(planBookImport(book, null, { activeJobs: 2, jobsThisMonth: 2 })).toMatchObject({
      breach: "concurrency",
    });
    expect(planBookImport(book, null, { activeJobs: 0, jobsThisMonth: 10 })).toMatchObject({
      breach: "monthly",
    });
  });

  it("follows raised limits from config", () => {
    const roomy = bookLimits({ maxPages: 1000 });
    expect(planBookImport({ ...book, pages: 900 }, null, fresh, roomy)).toEqual({
      action: "start",
    });
  });
});

describe("bookLimitMessage", () => {
  it("speaks plain English with no dashes", () => {
    const messages = [
      bookLimitMessage("pages", 600),
      bookLimitMessage("bytes", 500 * MB),
      bookLimitMessage("concurrency", 2),
      bookLimitMessage("monthly", 10),
    ];
    for (const message of messages) {
      expect(message).not.toMatch(new RegExp("[\\u2013\\u2014]"));
      expect(message.endsWith(".")).toBe(true);
    }
  });
});
