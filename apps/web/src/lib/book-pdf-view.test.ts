import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@ovenlovin/db", () => ({ getDatabase: () => ({}) }));
vi.mock("./book-print", async (original) => ({
  ...(await original<any>()),
  loadPrintBook: vi.fn(),
}));

import { loadPrintBook } from "./book-print";
import { loadPdfJob, pdfView, startBookPdf } from "./book-pdf-view";

const HOUSEHOLD = "22222222-2222-4222-8222-222222222222";
const BOOK = "00000000-0000-4000-8000-000000000020";
const JOB = "33333333-3333-4333-8333-333333333333";

const pages = Array.from({ length: 50 }, (_, i) => ({
  number: i + 1,
  kind: i === 3 ? "section" : "recipe",
}));

const job = (overrides: any = {}, inputOverrides: any = {}) => ({
  id: JOB,
  householdId: HOUSEHOLD,
  kind: "book_pdf",
  status: "running",
  input: {
    cookbookId: BOOK,
    mode: "shop",
    title: "Book",
    pageCount: 50,
    chunks: [
      { from: 1, to: 3 },
      { from: 4, to: 43 },
      { from: 44, to: 50 },
    ],
    ...inputOverrides,
  },
  ...overrides,
});

function fakeQueue(found: any = null, usage = { activeJobs: 0, jobsThisMonth: 0 }) {
  return {
    findBySha: vi.fn(async () => found?.id ?? null),
    get: vi.fn(async () => found),
    usage: vi.fn(async () => usage),
    enqueue: vi.fn(async () => "new-job"),
  } as any;
}

beforeEach(() => {
  process.env.OVENLOVIN_BOOKS = "1";
  vi.mocked(loadPrintBook).mockResolvedValue({ id: BOOK, title: "Book", subtitle: null, pages });
});

describe("pdfView", () => {
  it("counts parts done while running", () => {
    const view = pdfView(job(), [{ status: "done" }, { status: "running" }]);
    expect(view).toMatchObject({
      status: "running",
      done: 1,
      total: 4,
      pages: 50,
      downloadUrl: null,
    });
  });

  it("hands back the download once merged", () => {
    const pdf = { url: "x", downloadUrl: "y", bytes: 2048, lowRes: [{ page: 5, dpi: 120 }] };
    const view = pdfView(job({ status: "done" }, { pdf }), []);
    expect(view).toMatchObject({ status: "ready", done: 4, bytes: 2048 });
    expect(view.downloadUrl).toBe(`/api/v1/cookbooks/${BOOK}/pdf/${JOB}/download`);
    expect(view.lowRes).toHaveLength(1);
  });

  it("surfaces a failed part's error, and a retired PDF as expired", () => {
    expect(pdfView(job(), [{ status: "failed", error: "boom" }])).toMatchObject({
      status: "failed",
      error: "boom",
    });
    expect(pdfView(job({ status: "done" }, { pdf: null }), []).status).toBe("expired");
  });
});

describe("startBookPdf", () => {
  const args = { cookbookId: BOOK, householdId: HOUSEHOLD, mode: "shop" as const, origin: "o" };

  it("queues the first chunk with the book's chunk plan", async () => {
    const queue = fakeQueue();
    expect(await startBookPdf(queue, args)).toEqual({ jobId: "new-job", started: true });
    const [household, kind, input, items] = queue.enqueue.mock.calls[0];
    expect([household, kind]).toEqual([HOUSEHOLD, "book_pdf"]);
    expect(input).toMatchObject({ pageCount: 50, mode: "shop", origin: "o" });
    expect(input.chunks).toEqual([
      { from: 1, to: 3 },
      { from: 4, to: 43 },
      { from: 44, to: 50 },
    ]);
    expect(items).toEqual([{ step: "chunk", index: 0, key: "chunk-0" }]);
  });

  it("reuses a running or finished job for the same pages", async () => {
    const running = fakeQueue(job());
    expect(await startBookPdf(running, args)).toEqual({ jobId: JOB, started: false });
    const ready = fakeQueue(job({ status: "done" }, { pdf: { url: "x" } }));
    expect(await startBookPdf(ready, args)).toEqual({ jobId: JOB, started: false });
    const retired = fakeQueue(job({ status: "done" }, { pdf: null }));
    expect(await startBookPdf(retired, args)).toEqual({ jobId: "new-job", started: true });
  });

  it("refuses past the limits and for an empty book", async () => {
    const busy = fakeQueue(null, { activeJobs: 2, jobsThisMonth: 2 });
    expect(await startBookPdf(busy, args)).toHaveProperty("refused");
    vi.mocked(loadPrintBook).mockResolvedValue({ id: BOOK, title: "B", subtitle: null, pages: [] });
    expect(await startBookPdf(fakeQueue(), args)).toEqual({
      refused: "This book has no recipes yet.",
    });
    vi.mocked(loadPrintBook).mockResolvedValue(null);
    expect(await startBookPdf(fakeQueue(), args)).toBeNull();
  });
});

describe("loadPdfJob", () => {
  it("only opens this household's PDF of this cookbook", async () => {
    const queue = { get: async () => job() } as any;
    await expect(loadPdfJob(queue, BOOK, JOB, HOUSEHOLD)).resolves.toMatchObject({ id: JOB });
    await expect(loadPdfJob(queue, BOOK, JOB, "other")).rejects.toThrow();
    await expect(loadPdfJob(queue, "other-book", JOB, HOUSEHOLD)).rejects.toThrow();
    await expect(loadPdfJob(queue, BOOK, "nope", HOUSEHOLD)).rejects.toThrow();
  });
});
