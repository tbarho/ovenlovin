import { describe, expect, it } from "vitest";
import { bookLimits, checkBookLimits, checkPdfLimits } from "./entitlements";

describe("checkPdfLimits", () => {
  it("allows a PDF under the limits", () => {
    expect(checkPdfLimits({ activeJobs: 1, jobsThisMonth: 59 })).toEqual({ ok: true });
  });

  it("refuses while two are running, or past the month", () => {
    expect(checkPdfLimits({ activeJobs: 2, jobsThisMonth: 0 }).ok).toBe(false);
    expect(checkPdfLimits({ activeJobs: 0, jobsThisMonth: 60 }).ok).toBe(false);
    expect(
      checkPdfLimits(
        { activeJobs: 0, jobsThisMonth: 60 },
        { maxConcurrentJobs: 2, maxPdfsPerMonth: 100 }
      )
    ).toEqual({ ok: true });
  });
});

describe("checkBookLimits", () => {
  const fresh = { activeJobs: 0, jobsThisMonth: 0 };

  it("allows a book inside every limit", () => {
    expect(checkBookLimits({ ...fresh, pages: 600, bytes: 500 * 1024 * 1024 })).toEqual({
      ok: true,
    });
  });

  it("names the first limit a request breaks", () => {
    expect(checkBookLimits({ ...fresh, pages: 601 })).toMatchObject({ breach: "pages" });
    expect(checkBookLimits({ ...fresh, bytes: 500 * 1024 * 1024 + 1 })).toMatchObject({
      breach: "bytes",
    });
    expect(checkBookLimits({ activeJobs: 2, jobsThisMonth: 0 })).toMatchObject({
      breach: "concurrency",
    });
    expect(checkBookLimits({ activeJobs: 0, jobsThisMonth: 10 })).toMatchObject({
      breach: "monthly",
    });
  });

  it("raises a limit through config alone", () => {
    expect(checkBookLimits({ ...fresh, pages: 900 }, bookLimits({ maxPages: 1000 }))).toEqual({
      ok: true,
    });
  });
});
