import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { del, put } from "@vercel/blob";

/** Without a Blob token (local dev, e2e) PDFs live on disk under this prefix. */
const LOCAL = "local:";
const localRoot = () => path.join(os.tmpdir(), "ovenlovin-pdf");
const localPath = (url: string) => path.join(localRoot(), url.slice(LOCAL.length));

export type StoredPdf = { url: string; downloadUrl: string | null };

export type PdfStore = {
  put: (pathname: string, bytes: Uint8Array) => Promise<StoredPdf>;
  read: (url: string) => Promise<Uint8Array>;
  remove: (urls: string[]) => Promise<void>;
};

export const isLocalPdf = (url: string) => url.startsWith(LOCAL);

const localStore: PdfStore = {
  put: async (pathname, bytes) => {
    const url = `${LOCAL}${pathname}`;
    await mkdir(path.dirname(localPath(url)), { recursive: true });
    await writeFile(localPath(url), bytes);
    return { url, downloadUrl: null };
  },
  read: async (url) => new Uint8Array(await readFile(localPath(url))),
  remove: async (urls) => {
    await Promise.all(urls.map((url) => rm(localPath(url), { force: true })));
  },
};

const blobStore: PdfStore = {
  put: async (pathname, bytes) => {
    const stored = await put(pathname, Buffer.from(bytes), {
      access: "public",
      contentType: "application/pdf",
      addRandomSuffix: true,
    });
    return { url: stored.url, downloadUrl: stored.downloadUrl };
  },
  read: async (url) => {
    if (isLocalPdf(url)) return localStore.read(url);
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Could not read ${url}: ${response.status}`);
    return new Uint8Array(await response.arrayBuffer());
  },
  remove: async (urls) => {
    const remote = urls.filter((url) => !isLocalPdf(url));
    await Promise.all([
      remote.length ? del(remote) : undefined,
      localStore.remove(urls.filter(isLocalPdf)),
    ]);
  },
};

export function pdfStore(): PdfStore {
  return process.env.BLOB_READ_WRITE_TOKEN ? blobStore : localStore;
}
