import { upload as blobUpload } from "@vercel/blob/client";
import { api } from "@/lib/browser-api";

export const BOOK_NOT_PDF =
  "Choose a PDF of the book. For an ebook, export or print it to PDF first.";

export type BookStep =
  | { phase: "checking" }
  | { phase: "uploading"; loaded: number; total: number }
  | { phase: "saving" };

export type BookImportResult = { status: "started" | "resumed"; jobId: string; pages?: number };

const MB = 1024 * 1024;

export function megabytes(bytes: number) {
  return `${(bytes / MB).toFixed(1)} MB`;
}

export function bookUploadLabel(loaded: number, total: number) {
  return `Uploading ${megabytes(loaded)} of ${megabytes(total)}`;
}

export function bookDoneLabel(result: BookImportResult) {
  if (result.status === "resumed") {
    return "You already added this book. We'll pick up where it left off.";
  }
  if (result.pages && result.pages > 0) {
    return `Got it. ${result.pages} pages saved. Next we'll read the contents.`;
  }
  return "Got it. We're checking the file now. Next we'll read the contents.";
}

export function isPdf(file: File) {
  return file.type === "application/pdf" || /\.pdf$/i.test(file.name);
}

export async function fileSha256(file: Blob) {
  const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

const post = (body: object) =>
  api<any>("/api/v1/books/imports", { method: "POST", body: JSON.stringify(body) });

/**
 * Fingerprint, ask the server (resume or refuse before a single byte moves),
 * upload straight to Blob with byte progress, then register the job.
 */
export async function addBook(
  file: File,
  onStep: (step: BookStep) => void,
  { upload = blobUpload, hash = fileSha256 }: { upload?: any; hash?: typeof fileSha256 } = {}
): Promise<BookImportResult> {
  if (!isPdf(file)) throw new Error(BOOK_NOT_PDF);

  onStep({ phase: "checking" });
  const fingerprint = { sha256: await hash(file), bytes: file.size, name: file.name };
  const preflight = await post(fingerprint);
  if (preflight.status === "resumed") return preflight;

  onStep({ phase: "uploading", loaded: 0, total: file.size });
  const blob = await upload(preflight.pathname, file, {
    access: "public",
    contentType: "application/pdf",
    handleUploadUrl: "/api/v1/books/upload",
    multipart: file.size > 8 * MB,
    onUploadProgress: ({ loaded, total }: any) => onStep({ phase: "uploading", loaded, total }),
  });

  onStep({ phase: "saving" });
  return post({ ...fingerprint, blobUrl: blob.url });
}
