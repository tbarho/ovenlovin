import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { plainPdf, xrefPdf } from "@/test/pdf-fixture";
import { sha256Hex } from "@/lib/book-import";
import { verifyBookImport } from "@/lib/book-import-verify";

const HOUSEHOLD = "22222222-2222-4222-8222-222222222222";
const STORE = "abc.public.blob.vercel-storage.com";
const pdf = xrefPdf(3);
const sha256 = sha256Hex(pdf);
const blobUrl = `https://${STORE}/books/${HOUSEHOLD}/${sha256}.pdf`;

const del = vi.fn(async () => undefined);
vi.mock("@vercel/blob", () => ({ del: (...args: any[]) => (del as any)(...args) }));

describe("verifyBookImport", () => {
  const queue = {
    get: vi.fn(),
    patchInput: vi.fn(),
    items: vi.fn(async () => [] as any[]),
    addItems: vi.fn(),
  };

  beforeEach(() => {
    vi.stubEnv("BLOB_STORE_HOST", STORE);
    queue.get.mockResolvedValue({
      input: {
        blobUrl,
        sha256,
        bytes: pdf.byteLength,
        pages: 0,
        name: "Book.pdf",
        verified: false,
      },
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("hashes, counts pages, and patches the job", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(pdf))
    );
    const result = await verifyBookImport(queue as any, {
      id: "item-1",
      jobId: "job-1",
      householdId: HOUSEHOLD,
      kind: "book_import",
      seq: 0,
      payload: { step: "verify" },
      attempts: 1,
      leaseUntil: new Date(),
    });
    expect(result).toEqual({ pages: 3, bytes: pdf.byteLength });
    expect(queue.patchInput).toHaveBeenCalledWith("job-1", {
      pages: 3,
      bytes: pdf.byteLength,
      verified: true,
    });
    expect(queue.addItems).toHaveBeenCalledWith("job-1", [{ step: "contents" }]);
  });

  it("queues the contents step once, even on a retried verify", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(pdf))
    );
    queue.items.mockResolvedValueOnce([{ payload: { step: "contents" } }]);
    await verifyBookImport(queue as any, {
      id: "item-1",
      jobId: "job-1",
      householdId: HOUSEHOLD,
      kind: "book_import",
      seq: 0,
      payload: { step: "verify" },
      attempts: 2,
      leaseUntil: new Date(),
    });
    expect(queue.addItems).not.toHaveBeenCalled();
  });

  it("refuses over-page books and deletes the blob", async () => {
    const big = xrefPdf(601);
    const bigSha = sha256Hex(big);
    const bigUrl = `https://${STORE}/books/${HOUSEHOLD}/${bigSha}.pdf`;
    queue.get.mockResolvedValue({
      input: { blobUrl: bigUrl, sha256: bigSha, bytes: big.byteLength, pages: 0, name: "Big.pdf" },
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(big))
    );
    await expect(
      verifyBookImport(queue as any, {
        id: "item-1",
        jobId: "job-1",
        householdId: HOUSEHOLD,
        kind: "book_import",
        seq: 0,
        payload: { step: "verify" },
        attempts: 1,
        leaseUntil: new Date(),
      })
    ).rejects.toThrow(/more than 600 pages/);
    expect(del).toHaveBeenCalledWith([bigUrl]);
    expect(queue.patchInput).not.toHaveBeenCalled();
  });
});
