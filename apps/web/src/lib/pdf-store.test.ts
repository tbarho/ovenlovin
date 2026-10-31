import { afterEach, describe, expect, it, vi } from "vitest";

const put = vi.fn(async (pathname: string, _body: unknown, options: any) => ({
  url: `https://store.${options.access}.blob.vercel-storage.com/${pathname}`,
  downloadUrl: `https://store.${options.access}.blob.vercel-storage.com/${pathname}?download=1`,
}));
const get = vi.fn();
vi.mock("@vercel/blob", () => ({
  put: (...args: any[]) => (put as any)(...args),
  get: (...args: any[]) => get(...args),
  del: vi.fn(async () => undefined),
}));

import { openPdf, pdfStore } from "@/lib/pdf-store";

const TOKEN = "vercel_blob_rw_store_secretpart";

afterEach(() => {
  vi.unstubAllEnvs();
  put.mockClear();
  get.mockReset();
});

describe("pdfStore", () => {
  it("writes public with only the project token, as before", async () => {
    vi.stubEnv("BLOB_READ_WRITE_TOKEN", "vercel_blob_rw_pub_x");
    vi.stubEnv("BOOKS_BLOB_PRIVATE_READ_WRITE_TOKEN", "");
    await pdfStore().put("book-pdf/h/j/book.pdf", new Uint8Array([1]));
    expect(put.mock.calls[0]![2]).toEqual({
      access: "public",
      contentType: "application/pdf",
      addRandomSuffix: true,
    });
  });

  it("writes private with the books token", async () => {
    vi.stubEnv("BLOB_READ_WRITE_TOKEN", "");
    vi.stubEnv("BOOKS_BLOB_PRIVATE_READ_WRITE_TOKEN", TOKEN);
    const stored = await pdfStore().put("book-pdf/h/j/book.pdf", new Uint8Array([1]));
    expect(put.mock.calls[0]![2]).toEqual({
      access: "private",
      token: TOKEN,
      contentType: "application/pdf",
      addRandomSuffix: true,
    });
    expect(stored.url).toContain(".private.blob.vercel-storage.com/");
  });

  it("keeps the local disk store without any Blob token", async () => {
    vi.stubEnv("BLOB_READ_WRITE_TOKEN", "");
    vi.stubEnv("BOOKS_BLOB_PRIVATE_READ_WRITE_TOKEN", "");
    const stored = await pdfStore().put("book-pdf/h/j/local.pdf", new Uint8Array([7, 8]));
    expect(stored).toEqual({ url: "local:book-pdf/h/j/local.pdf", downloadUrl: null });
    expect(put).not.toHaveBeenCalled();
    const file = await openPdf(stored.url);
    expect(file.bytes).toBe(2);
  });
});

describe("openPdf", () => {
  it("streams a private PDF with the books token", async () => {
    vi.stubEnv("BOOKS_BLOB_PRIVATE_READ_WRITE_TOKEN", TOKEN);
    get.mockResolvedValue({
      statusCode: 200,
      stream: new Response("%PDF").body,
      headers: new Headers(),
      blob: { contentType: "application/pdf", size: 4 },
    });
    const url = "https://store.private.blob.vercel-storage.com/book-pdf/h/j/book.pdf";
    const file = await openPdf(url);
    expect(get).toHaveBeenCalledWith(url, { access: "private", token: TOKEN });
    expect(file.bytes).toBe(4);
    expect(await new Response(file.body).text()).toBe("%PDF");
  });
});
