import { afterEach, describe, expect, it, vi } from "vitest";

const get = vi.fn();
const del = vi.fn(async () => undefined);
vi.mock("@vercel/blob", () => ({
  get: (...args: any[]) => get(...args),
  del: (...args: any[]) => (del as any)(...args),
}));

import {
  bookBlobAccess,
  bookBlobHeaders,
  deleteBookBlobs,
  fetchBookBlob,
  privateBookStoreHost,
} from "@/lib/books-blob";

const TOKEN = "vercel_blob_rw_PrIv9_secretpart";
const PRIVATE = { BOOKS_BLOB_PRIVATE_READ_WRITE_TOKEN: TOKEN };
const privateUrl = "https://priv9.private.blob.vercel-storage.com/books/h/x-Ab3.pdf";
const publicUrl = "https://abc.public.blob.vercel-storage.com/books/h/x-Ab3.pdf";

afterEach(() => {
  vi.unstubAllGlobals();
  get.mockReset();
  del.mockClear();
});

describe("bookBlobAccess", () => {
  it("stays public without the books token", () => {
    expect(bookBlobAccess({ BLOB_READ_WRITE_TOKEN: "vercel_blob_rw_abc_x" })).toEqual({
      access: "public",
    });
    expect(bookBlobAccess({ BOOKS_BLOB_PRIVATE_READ_WRITE_TOKEN: "  " })).toEqual({
      access: "public",
    });
  });

  it("goes private with the books token", () => {
    expect(bookBlobAccess(PRIVATE)).toEqual({ access: "private", token: TOKEN });
  });
});

describe("privateBookStoreHost", () => {
  it("derives the private host from the books token", () => {
    expect(privateBookStoreHost(PRIVATE)).toBe("priv9.private.blob.vercel-storage.com");
    expect(privateBookStoreHost({})).toBeNull();
  });
});

describe("fetchBookBlob", () => {
  it("reads a private blob with get and the books token", async () => {
    const stream = new Response("pdf bytes").body;
    get.mockResolvedValue({
      statusCode: 200,
      stream,
      headers: new Headers(),
      blob: { contentType: "application/pdf", size: 9 },
    });
    const response = await fetchBookBlob(privateUrl, PRIVATE);
    expect(get).toHaveBeenCalledWith(privateUrl, { access: "private", token: TOKEN });
    expect(response.status).toBe(200);
    expect(await response.text()).toBe("pdf bytes");
  });

  it("reports a missing private blob as 404 and a private URL without a token as 403", async () => {
    get.mockResolvedValue(null);
    expect((await fetchBookBlob(privateUrl, PRIVATE)).status).toBe(404);
    expect((await fetchBookBlob(privateUrl, {})).status).toBe(403);
  });

  it("fetches a public blob plainly, even with the books token set", async () => {
    const fetch = vi.fn(async () => new Response("old public"));
    vi.stubGlobal("fetch", fetch);
    expect(await (await fetchBookBlob(publicUrl, PRIVATE)).text()).toBe("old public");
    expect(fetch).toHaveBeenCalledWith(publicUrl);
    expect(get).not.toHaveBeenCalled();
  });
});

describe("bookBlobHeaders", () => {
  it("sends the bearer token only for private blobs", () => {
    expect(bookBlobHeaders(privateUrl, PRIVATE)).toEqual({ authorization: `Bearer ${TOKEN}` });
    expect(bookBlobHeaders(publicUrl, PRIVATE)).toBeUndefined();
    expect(bookBlobHeaders("/tmp/book.pdf", PRIVATE)).toBeUndefined();
  });
});

describe("deleteBookBlobs", () => {
  it("deletes each blob with its own store's token", async () => {
    await deleteBookBlobs([publicUrl, privateUrl], PRIVATE);
    expect(del).toHaveBeenCalledWith([publicUrl]);
    expect(del).toHaveBeenCalledWith([privateUrl], { token: TOKEN });
  });
});
