import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { plainPdf } from "@/test/pdf-fixture";
import { sha256Hex } from "@/lib/book-import";

const HOUSEHOLD = "22222222-2222-4222-8222-222222222222";
const STORE = "abc.public.blob.vercel-storage.com";

const queue = {
  findBySha: vi.fn(),
  get: vi.fn(),
  usage: vi.fn(),
  enqueue: vi.fn(),
};
const del = vi.fn(async () => undefined);
const kickWorker = vi.fn(async (_origin: string) => undefined);

vi.mock("@ovenlovin/db", () => ({ getDatabase: () => ({}) }));
vi.mock("@vercel/blob", () => ({ del: (...args: any[]) => (del as any)(...args) }));
vi.mock("@/lib/jobs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/jobs")>();
  return { ...actual, jobQueue: () => queue, kickWorker: (origin: string) => kickWorker(origin) };
});
vi.mock("@/lib/api/middleware", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/middleware")>();
  return {
    ...actual,
    getRequestContext: async () => ({
      userId: "11111111-1111-4111-8111-111111111111",
      householdId: HOUSEHOLD,
      membershipRole: "owner" as const,
    }),
  };
});

import { POST } from "./route";
import { POST as UPLOAD } from "../upload/route";

const pdf = plainPdf(3);
const sha256 = sha256Hex(pdf);
const blobUrl = `https://${STORE}/books/${HOUSEHOLD}/${sha256}-Xy.pdf`;

const post = (body: object, handler = POST) =>
  handler(
    new NextRequest("http://localhost/api/v1/books/imports", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    })
  );

describe("POST /books/imports", () => {
  beforeEach(() => {
    vi.stubEnv("OVENLOVIN_BOOKS", "1");
    vi.stubEnv("BLOB_STORE_HOST", STORE);
    queue.findBySha.mockResolvedValue(null);
    queue.usage.mockResolvedValue({ activeJobs: 0, jobsThisMonth: 0 });
    queue.enqueue.mockResolvedValue("job-new");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("is not found while the books flag is off", async () => {
    vi.stubEnv("OVENLOVIN_BOOKS", "");
    expect((await post({ sha256, bytes: pdf.byteLength, name: "Book.pdf" })).status).toBe(404);
    expect((await post({}, UPLOAD)).status).toBe(404);
    expect(queue.findBySha).not.toHaveBeenCalled();
  });

  it("hands back an upload path for a new book", async () => {
    const response = await post({ sha256, bytes: pdf.byteLength, name: "Book.pdf" });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      status: "upload",
      pathname: `books/${HOUSEHOLD}/${sha256}.pdf`,
    });
  });

  it("resumes the existing job when the same file comes back, before any upload", async () => {
    queue.findBySha.mockResolvedValue("job-1");
    queue.get.mockResolvedValue({ input: { pages: 312, blobUrl } });

    const response = await post({ sha256, bytes: pdf.byteLength, name: "Book.pdf" });
    expect(await response.json()).toEqual({ status: "resumed", jobId: "job-1", pages: 312 });
    expect(queue.findBySha).toHaveBeenCalledWith(HOUSEHOLD, "book_import", sha256);
    expect(queue.usage).not.toHaveBeenCalled();
    expect(queue.enqueue).not.toHaveBeenCalled();
  });

  it("refuses an oversized file politely before it uploads", async () => {
    const response = await post({ sha256, bytes: 600 * 1024 * 1024, name: "Book.pdf" });
    expect(response.status).toBe(400);
    const problem = await response.json();
    expect(problem.detail).toBe("This file is bigger than 500 MB. Try a smaller copy of the book.");
    expect(problem.breach).toBe("bytes");
  });

  it("refuses when the household already has books being read", async () => {
    queue.usage.mockResolvedValue({ activeJobs: 2, jobsThisMonth: 2 });
    const response = await post({ sha256, bytes: pdf.byteLength, name: "Book.pdf" });
    expect((await response.json()).detail).toMatch(/already have 2 books being read/);
  });

  it("creates the book_import job without downloading the PDF", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const response = await post({ sha256, bytes: pdf.byteLength, name: "Book.pdf", blobUrl });

    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ status: "started", jobId: "job-new" });
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(queue.enqueue).toHaveBeenCalledWith(
      HOUSEHOLD,
      "book_import",
      {
        blobUrl,
        sha256,
        bytes: pdf.byteLength,
        pages: 0,
        name: "Book.pdf",
        verified: false,
      },
      [{ step: "verify" }]
    );
    expect(kickWorker).toHaveBeenCalled();
  });

  it("rejects a blob URL outside this household's book folder", async () => {
    const response = await post({
      sha256,
      bytes: pdf.byteLength,
      name: "Book.pdf",
      blobUrl: `https://${STORE}/books/other/x.pdf`,
    });
    expect(response.status).toBe(400);
    expect(queue.enqueue).not.toHaveBeenCalled();
  });

  it("rejects a blob URL on another Blob store", async () => {
    const response = await post({
      sha256,
      bytes: pdf.byteLength,
      name: "Book.pdf",
      blobUrl: `https://evil.public.blob.vercel-storage.com/books/${HOUSEHOLD}/x.pdf`,
    });
    expect(response.status).toBe(400);
    expect(queue.enqueue).not.toHaveBeenCalled();
  });
});
