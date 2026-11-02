import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const HOUSEHOLD = "22222222-2222-4222-8222-222222222222";
const COOKBOOK = "33333333-3333-4333-8333-333333333333";
const JOB = "44444444-4444-4444-8444-444444444444";
const TOKEN = "vercel_blob_rw_store_secretpart";

const get = vi.fn();
const queue = { get: vi.fn() };

vi.mock("@ovenlovin/db", () => ({ getDatabase: () => ({}) }));
vi.mock("@vercel/blob", () => ({
  get: (...args: any[]) => get(...args),
  put: vi.fn(),
  del: vi.fn(),
}));
vi.mock("@/lib/jobs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/jobs")>();
  return { ...actual, isBooksEnabled: () => true, jobQueue: () => queue };
});
vi.mock("@/lib/book-pdf-view", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/book-pdf-view")>();
  return { ...actual, loadPdfJob: async () => queue.get() };
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

import { GET } from "./route";

const job = (url: string) => ({
  id: JOB,
  householdId: HOUSEHOLD,
  kind: "book_pdf",
  input: {
    cookbookId: COOKBOOK,
    mode: "home",
    title: "Household 1 Suppers",
    pdf: { url, downloadUrl: `${url}?download=1`, bytes: 4, lowRes: [] },
  },
});

const call = () =>
  GET(new NextRequest(`http://localhost/api/v1/cookbooks/${COOKBOOK}/pdf/${JOB}/download`), {
    params: Promise.resolve({ id: COOKBOOK, jobId: JOB }),
  });

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  get.mockReset();
});

describe("GET /cookbooks/[id]/pdf/[jobId]/download", () => {
  it("streams a private PDF as an attachment instead of redirecting", async () => {
    vi.stubEnv("BOOKS_BLOB_PRIVATE_READ_WRITE_TOKEN", TOKEN);
    const url = `https://store.private.blob.vercel-storage.com/book-pdf/${HOUSEHOLD}/${JOB}/x.pdf`;
    queue.get.mockResolvedValue(job(url));
    get.mockResolvedValue({
      statusCode: 200,
      stream: new Response("%PDF").body,
      headers: new Headers(),
      blob: { contentType: "application/pdf", size: 4 },
    });

    const response = await call();
    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
    expect(response.headers.get("content-type")).toBe("application/pdf");
    expect(response.headers.get("content-disposition")).toBe(
      'attachment; filename="household-1-suppers-home.pdf"'
    );
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(get).toHaveBeenCalledWith(url, { access: "private", token: TOKEN });
    expect(await response.text()).toBe("%PDF");
  });

  it("still redirects a legacy public-store PDF, as before the private store", async () => {
    const url = `https://store.public.blob.vercel-storage.com/book-pdf/${HOUSEHOLD}/${JOB}/x.pdf`;
    queue.get.mockResolvedValue(job(url));
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);

    const response = await call();
    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe(`${url}?download=1`);
    expect(fetch).not.toHaveBeenCalled();
  });
});
