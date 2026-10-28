import { PermanentJobError, type ClaimedItem, type JobQueue } from "@ovenlovin/core/jobs";
import {
  launchChromium,
  mergeChunks,
  pdfPageCount,
  renderChunk,
  type RenderedChunk,
} from "@/lib/book-pdf";
import { pdfFileName, type BookPdfInput } from "@/lib/book-pdf-view";
import { printToken } from "@/lib/book-print";
import { pdfStore, type PdfStore } from "@/lib/pdf-store";

/** Worker-side half of the print PDF. Only the job handlers import this: it pulls in Chromium. */
export type PdfDeps = {
  store?: PdfStore;
  /* eslint-disable no-unused-vars -- call-signature parameter names */
  render?: (url: string, headers: Record<string, string>) => Promise<RenderedChunk>;
  /* eslint-enable no-unused-vars */
};

export const BOOK_CHANGED = "This book changed while it was printing. Make the PDF again.";

const chunkPath = (householdId: string, jobId: string, index: number) =>
  `book-pdf/${householdId}/${jobId}/chunk-${index}.pdf`;

/** Vercel preview deployments sit behind protection; the renderer carries the bypass. */
function renderHeaders(): Record<string, string> {
  const bypass = process.env.VERCEL_AUTOMATION_BYPASS_SECRET?.trim();
  return bypass ? { "x-vercel-protection-bypass": bypass } : {};
}

async function renderOnce(url: string, headers: Record<string, string>) {
  const browser = await launchChromium();
  try {
    return await renderChunk(browser, url, headers);
  } finally {
    await browser.close();
  }
}

export function printUrl(
  input: BookPdfInput,
  householdId: string,
  chunk: { from: number; to: number }
) {
  const query = new URLSearchParams({
    mode: input.mode,
    from: String(chunk.from),
    to: String(chunk.to),
    token: printToken(input.cookbookId, householdId),
  });
  return `${input.origin}/print/cookbooks/${input.cookbookId}?${query}`;
}

/**
 * Renders one page range. Chunks run one after another: each queues the next
 * and the last queues the merge, so the merge never races a running chunk.
 */
export async function renderPdfChunk(queue: JobQueue, item: ClaimedItem, deps: PdfDeps = {}) {
  const store = deps.store ?? pdfStore();
  const render = deps.render ?? renderOnce;
  const job = await queue.get(item.jobId);
  const input = job?.input as BookPdfInput | undefined;
  const index = Number(item.payload.index);
  const chunk = input?.chunks[index];
  if (!input || !chunk) throw new PermanentJobError(`No chunk ${index} on ${item.jobId}`);

  const rendered = await render(printUrl(input, item.householdId, chunk), renderHeaders());
  if (rendered.sha !== input.sha256) throw new PermanentJobError(BOOK_CHANGED);
  const pages = await pdfPageCount(rendered.bytes);
  const want = chunk.to - chunk.from + 1;
  if (pages !== want) {
    throw new PermanentJobError(
      `Pages ${chunk.from}-${chunk.to} printed ${pages} sheets, not ${want}`
    );
  }

  const stored = await store.put(chunkPath(item.householdId, item.jobId, index), rendered.bytes);
  const next =
    index + 1 < input.chunks.length
      ? { step: "chunk", index: index + 1, key: `chunk-${index + 1}` }
      : { step: "merge", key: "merge" };
  await queue.addItems(item.jobId, [next], new Date(), "key");
  return { url: stored.url, pages, lowRes: rendered.lowRes };
}

const chunkRows = (rows: any[]) =>
  rows
    .filter((row: any) => row.payload?.step === "chunk")
    .sort((a: any, b: any) => a.payload.index - b.payload.index);

/** Stitches the chunks, checks the page count against the book, and keeps only the newest PDF. */
export async function mergeBookPdf(queue: JobQueue, item: ClaimedItem, deps: PdfDeps = {}) {
  const store = deps.store ?? pdfStore();
  const job = await queue.get(item.jobId);
  const input = job?.input as BookPdfInput | undefined;
  if (!input) throw new PermanentJobError(`No job ${item.jobId}`);

  const chunks = chunkRows(await queue.items(item.jobId));
  const missing =
    chunks.length !== input.chunks.length || chunks.some((row: any) => row.status !== "done");
  if (missing) throw new PermanentJobError("Some pages did not print");

  const parts = await Promise.all(chunks.map((row: any) => store.read(row.result.url)));
  const bytes = await mergeChunks(parts, { mode: input.mode, title: input.title });
  const pages = await pdfPageCount(bytes);
  if (pages !== input.pageCount) {
    throw new PermanentJobError(`The PDF has ${pages} pages, the book has ${input.pageCount}`);
  }

  const stored = await store.put(
    `book-pdf/${item.householdId}/${item.jobId}/${pdfFileName(input)}`,
    bytes
  );
  const lowRes = chunks.flatMap((row: any) => row.result.lowRes ?? []);
  await queue.patchInput(item.jobId, {
    pdf: { url: stored.url, downloadUrl: stored.downloadUrl, bytes: bytes.length, lowRes },
  });
  await store.remove(chunks.map((row: any) => row.result.url));
  await retireOlder(queue, store, item, input);
  return { url: stored.url, pages };
}

/**
 * Older PDFs of the same book and mode are stale the moment a newer one
 * exists. Chunks a stopped run left behind go too.
 */
async function retireOlder(
  queue: JobQueue,
  store: PdfStore,
  item: ClaimedItem,
  input: BookPdfInput
) {
  const ids = (await queue.recent(item.householdId, "book_pdf", 50, true)).filter(
    (id) => id !== item.jobId
  );
  const jobs = await Promise.all(ids.map((id) => queue.get(id)));
  const stale = jobs.filter((other: any) => {
    const otherInput = other?.input as BookPdfInput | undefined;
    const settled = other?.status === "done" || other?.status === "failed";
    return settled && otherInput?.cookbookId === input.cookbookId && otherInput.mode === input.mode;
  });
  const finished = stale.filter((other: any) => other.input.pdf);
  const leftovers = await Promise.all(
    stale
      .filter((other: any) => !other.input.pdf)
      .map(async (other: any) =>
        chunkRows(await queue.items(other.id))
          .map((row: any) => row.result?.url)
          .filter(Boolean)
      )
  );
  await store.remove([...finished.map((other: any) => other.input.pdf.url), ...leftovers.flat()]);
  await Promise.all(finished.map((other: any) => queue.patchInput(other.id, { pdf: null })));
}
