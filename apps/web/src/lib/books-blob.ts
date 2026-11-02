import { del, get } from "@vercel/blob";

type Env = Record<string, string | undefined>;

/**
 * Read-write token of a PRIVATE Vercel Blob store for book files: uploaded
 * source PDFs and generated print PDFs. Copyrighted books must not sit behind
 * a guessable public URL, so when this is set new book files are written
 * `access: "private"` and only reach the browser through authed routes.
 *
 * Unset (today, and in dev): book files stay on the project's public store
 * via BLOB_READ_WRITE_TOKEN, exactly as before. Reads pick the path from the
 * URL host, so public blobs written before the switch stay readable.
 */
export const BOOKS_PRIVATE_TOKEN_ENV = "BOOKS_BLOB_PRIVATE_READ_WRITE_TOKEN";

const PRIVATE_HOST = ".private.blob.vercel-storage.com";

export function booksPrivateToken(env: Env = process.env) {
  return env[BOOKS_PRIVATE_TOKEN_ENV]?.trim() || null;
}

export type BookBlobAccess =
  { access: "public"; token?: undefined } | { access: "private"; token: string };

/** How new book files are written: private with the books token, else public as before. */
export function bookBlobAccess(env: Env = process.env): BookBlobAccess {
  const token = booksPrivateToken(env);
  return token ? { access: "private", token } : { access: "public" };
}

/** Host of the private books store, from its token (vercel_blob_rw_<storeId>_...). */
export function privateBookStoreHost(env: Env = process.env) {
  const match = booksPrivateToken(env)?.match(/^vercel_blob_rw_([A-Za-z0-9]+)_/);
  return match ? `${match[1]!.toLowerCase()}${PRIVATE_HOST}` : null;
}

export function isPrivateBlobUrl(url: string) {
  try {
    return new URL(url).hostname.toLowerCase().endsWith(PRIVATE_HOST);
  } catch {
    return false;
  }
}

/**
 * Server read of a book blob. Private blobs go through `get` with the books
 * token; public ones are a plain fetch. Missing comes back as a 404 response.
 */
export async function fetchBookBlob(url: string, env: Env = process.env): Promise<Response> {
  if (!isPrivateBlobUrl(url)) return fetch(url);
  const token = booksPrivateToken(env);
  if (!token) return new Response(null, { status: 403 });
  const found = await get(url, { access: "private", token });
  if (!found || found.statusCode !== 200) return new Response(null, { status: 404 });
  return new Response(found.stream, {
    status: 200,
    headers: {
      "content-type": found.blob.contentType,
      "content-length": String(found.blob.size),
    },
  });
}

/** Headers pdf.js needs for range reads of a book blob (none for public ones). */
export function bookBlobHeaders(url: string, env: Env = process.env) {
  const token = isPrivateBlobUrl(url) ? booksPrivateToken(env) : null;
  return token ? { authorization: `Bearer ${token}` } : undefined;
}

/** Deletes book blobs, each with the token of the store it lives on. */
export async function deleteBookBlobs(urls: string[], env: Env = process.env) {
  const secret = urls.filter(isPrivateBlobUrl);
  const open = urls.filter((url) => !isPrivateBlobUrl(url));
  const token = booksPrivateToken(env);
  await Promise.all([
    open.length ? del(open) : undefined,
    secret.length && token ? del(secret, { token }) : undefined,
  ]);
}
