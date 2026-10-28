import { describe, expect, it, vi } from "vitest";
import { PDFDocument } from "pdf-lib";

vi.mock("@ovenlovin/db", () => ({ getDatabase: () => ({}) }));

import { BOOK_CHANGED, mergeBookPdf, printUrl, renderPdfChunk } from "./book-pdf-job";
import { readPrintToken } from "./book-print";

const HOUSEHOLD = "22222222-2222-4222-8222-222222222222";
const BOOK = "00000000-0000-4000-8000-000000000020";
const JOB = "33333333-3333-4333-8333-333333333333";

async function sheets(count: number) {
  const doc = await PDFDocument.create();
  Array.from({ length: count }).forEach(() => doc.addPage([612, 792]));
  return doc.save();
}

const input = (overrides: any = {}) => ({
  cookbookId: BOOK,
  mode: "home",
  title: "Family Book",
  sha256: "sha",
  pageCount: 5,
  chunks: [
    { from: 1, to: 3 },
    { from: 4, to: 5 },
  ],
  origin: "https://app.test",
  ...overrides,
});

/** In-memory queue + store, enough to drive the chunk chain. */
function harness(jobInput = input()) {
  const jobs: Record<string, any> = {
    [JOB]: {
      id: JOB,
      householdId: HOUSEHOLD,
      kind: "book_pdf",
      status: "running",
      input: jobInput,
    },
  };
  const rows: any[] = [];
  const files = new Map<string, Uint8Array>();
  const queue: any = {
    get: async (id: string) => jobs[id] ?? null,
    items: async (id: string) => rows.filter((row) => row.jobId === id),
    addItems: async (jobId: string, payloads: any[], _now: any, uniqueBy: string) => {
      const fresh = payloads.filter(
        (p) => !rows.some((row) => row.jobId === jobId && row.payload[uniqueBy] === p[uniqueBy])
      );
      fresh.forEach((payload) => rows.push({ jobId, payload, status: "pending" }));
      return fresh.length;
    },
    patchInput: async (id: string, patch: any) => {
      jobs[id].input = { ...jobs[id].input, ...patch };
    },
    recent: async () => Object.keys(jobs),
  };
  const store = {
    put: async (pathname: string, bytes: Uint8Array) => {
      files.set(`mem:${pathname}`, bytes);
      return { url: `mem:${pathname}`, downloadUrl: null };
    },
    read: async (url: string) => files.get(url)!,
    remove: async (urls: string[]) => {
      urls.forEach((url) => files.delete(url));
    },
  };
  const item = (payload: any) => ({ id: "i", jobId: JOB, householdId: HOUSEHOLD, payload }) as any;
  /** Runs the queued items in order like the worker would, completing each one. */
  const drain = async (render: any) => {
    rows.push({
      jobId: JOB,
      payload: { step: "chunk", index: 0, key: "chunk-0" },
      status: "pending",
    });
    let row = rows.find((r) => r.status === "pending");
    while (row) {
      const handler = row.payload.step === "merge" ? mergeBookPdf : renderPdfChunk;
      row.result = await handler(queue, item(row.payload), { store, render });
      row.status = "done";
      row = rows.find((r) => r.status === "pending");
    }
  };
  return { jobs, rows, files, queue, store, item, drain };
}

describe("book_pdf job", () => {
  it("renders chunks in order, then merges a book with the model's page count", async () => {
    const h = harness();
    const urls: string[] = [];
    const render = async (url: string) => {
      urls.push(url);
      const to = Number(new URL(url).searchParams.get("to"));
      const from = Number(new URL(url).searchParams.get("from"));
      return { bytes: await sheets(to - from + 1), sha: "sha", lowRes: [{ page: from, dpi: 150 }] };
    };
    await h.drain(render);

    expect(h.rows.map((row) => row.payload.key)).toEqual(["chunk-0", "chunk-1", "merge"]);
    expect(urls.map((url) => new URL(url).searchParams.get("from"))).toEqual(["1", "4"]);
    const pdf = h.jobs[JOB].input.pdf;
    expect(await PDFDocument.load(h.files.get(pdf.url)!).then((d) => d.getPageCount())).toBe(5);
    expect(pdf.lowRes).toEqual([
      { page: 1, dpi: 150 },
      { page: 4, dpi: 150 },
    ]);
    expect([...h.files.keys()].some((key) => key.includes("chunk-"))).toBe(false);
    expect(pdf.url).toContain("family-book-home.pdf");
  });

  it("stops when the book changed under the job", async () => {
    const h = harness();
    const render = async () => ({ bytes: await sheets(3), sha: "other", lowRes: [] });
    await expect(
      renderPdfChunk(h.queue, h.item({ step: "chunk", index: 0 }), { store: h.store, render })
    ).rejects.toThrow(BOOK_CHANGED);
  });

  it("stops when a chunk prints more sheets than pages (an overflow)", async () => {
    const h = harness();
    const render = async () => ({ bytes: await sheets(4), sha: "sha", lowRes: [] });
    await expect(
      renderPdfChunk(h.queue, h.item({ step: "chunk", index: 0 }), { store: h.store, render })
    ).rejects.toThrow(/printed 4 sheets, not 3/);
  });

  it("signs the print url for this household and cookbook", () => {
    const url = new URL(printUrl(input() as any, HOUSEHOLD, { from: 4, to: 5 }));
    expect(url.pathname).toBe(`/print/cookbooks/${BOOK}`);
    expect(readPrintToken(url.searchParams.get("token"), BOOK)).toBe(HOUSEHOLD);
  });

  it("retires an older PDF of the same book and mode", async () => {
    const h = harness();
    const old = "44444444-4444-4444-8444-444444444444";
    await h.store.put("old.pdf", await sheets(1));
    h.jobs[old] = {
      id: old,
      status: "done",
      input: input({ pdf: { url: "mem:old.pdf", downloadUrl: null, bytes: 1, lowRes: [] } }),
    };
    const render = async (url: string) => {
      const params = new URL(url).searchParams;
      return {
        bytes: await sheets(Number(params.get("to")) - Number(params.get("from")) + 1),
        sha: "sha",
        lowRes: [],
      };
    };
    await h.drain(render);
    expect(h.jobs[old].input.pdf).toBeNull();
    expect(h.files.has("mem:old.pdf")).toBe(false);
  });
});
