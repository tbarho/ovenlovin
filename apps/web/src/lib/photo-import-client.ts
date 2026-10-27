import type { PhotoImportPreview } from "./photo-import";

export const PHOTO_IMPORT_TIMEOUT_MS = 60_000;
export const PHOTO_IMPORT_MAX_EDGE = 1600;
export const PHOTO_IMPORT_MAX_PAGES = 6;
/** Total upload budget, with headroom under Vercel's 4.5MB body cap for multipart overhead. */
export const PHOTO_IMPORT_BUDGET_BYTES = Math.round(3.8 * 1024 * 1024);
export const PHOTO_IMPORT_QUALITY = 0.82;
export const PHOTO_IMPORT_FALLBACK_QUALITY = 0.68;
export const PHOTO_IMPORT_TOO_MANY_PAGES_MESSAGE =
  "Too many pages for one import. Try 4 or fewer, or crop closer.";
export const PHOTO_PICK_LEAD =
  "Drop a recipe card, cookbook page, or screenshot here. Recipe on more than one page? Add each page.";
/** Stay under Vercel's 4.5MB body limit after base64. Demo has no Blob. */
export const PHOTO_SAVE_MAX_EDGE = 1280;
export const PHOTO_SAVE_MAX_BYTES = 700_000;
export const PHOTO_IMPORT_ESTIMATE = "Usually under a minute";
export const PHOTO_IMPORT_SLOW = "Still reading. Handwriting and extra pages take longer.";
export const PHOTO_IMPORT_NEAR_TIMEOUT =
  "Almost out of time. If this fails, you can retry or type it in.";
export const PHOTO_IMPORT_SLOW_MS = 30_000;
export const PHOTO_IMPORT_NEAR_TIMEOUT_MS = 50_000;
export const PHOTO_IMPORT_IN_PROGRESS = "Import in progress";
export const PHOTO_IMPORT_TIMEOUT_MESSAGE =
  "That photo took too long to read. Try again, or type or paste it.";
export const PHOTO_IMPORT_BLURRY_MESSAGE =
  "This photo is hard to read. Try a sharper read, or retake it in good light.";
export const PHOTO_IMPORT_SHARPER = "Try a sharper read";
export const PHOTO_IMPORT_SHARPER_ANNOUNCEMENT = "Trying a sharper read.";
export const PHOTO_IMPORT_STILL_BLURRY =
  "Still hard to read. Retake it closer, flat, in good light, or type it in.";
export const PHOTO_IMPORT_REPLACE_EDITS = "Replace your edits with the new read?";
export const PHOTO_IMPORT_ENHANCE_MAX_EDGE = 2400;
export const PHOTO_IMPORT_ENHANCE_QUALITY = 0.9;
export const PHOTO_IMPORT_NOT_RECIPE_MESSAGE =
  "That does not look like a recipe. Type or paste it instead.";
export const PHOTO_IMPORT_NETWORK_MESSAGE = "Connection lost. Check your network and try again.";
export const PHOTO_IMPORT_CANCELLED_MESSAGE = "Photo import cancelled";
export const PHOTO_IMPORT_TOO_LARGE_MESSAGE = "That photo is too large. Try a closer crop.";
export const PHOTO_SAVE_NO_IMAGE_MESSAGE =
  "Recipe saved, but the photo could not be stored. Open the recipe - do not import it again.";

export type PhotoImportPhase = "uploading" | "reading" | "review" | "error";
export type PhotoImportErrorKind =
  "timeout" | "network" | "blurry" | "not_recipe" | "cancelled" | "generic";

export const PHOTO_IMPORT_STEPS: Array<{
  id: Exclude<PhotoImportPhase, "error">;
  label: string;
}> = [
  { id: "uploading", label: "Uploading" },
  { id: "reading", label: "Reading" },
  { id: "review", label: "Ready to review" },
];

export type PhotoImportProblem = {
  detail?: string;
  title?: string;
  code?: string;
};

function abortError(kind: "timeout" | "cancelled"): Error {
  const error = new Error(
    kind === "timeout" ? PHOTO_IMPORT_TIMEOUT_MESSAGE : PHOTO_IMPORT_CANCELLED_MESSAGE
  );
  error.name = kind === "timeout" ? "TimeoutError" : "AbortError";
  return error;
}

export type PhotoImportStepState = "done" | "current" | "todo";

export function photoImportStepState(
  step: (typeof PHOTO_IMPORT_STEPS)[number]["id"],
  phase: PhotoImportPhase
): PhotoImportStepState {
  if (phase === "review") return "done";
  const order = PHOTO_IMPORT_STEPS.map((item) => item.id);
  const current = order.indexOf(phase === "error" ? "reading" : phase);
  const index = order.indexOf(step);
  if (index < current) return "done";
  if (index === current) return "current";
  return "todo";
}

export function classifyPhotoImportProblem(problem: PhotoImportProblem): PhotoImportErrorKind {
  const code = (problem.code ?? "").toLowerCase();
  const text = `${problem.detail ?? ""} ${problem.title ?? ""}`.toLowerCase();
  if (code === "photo_blurry" || text.includes("blurry") || text.includes("hard to read")) {
    return "blurry";
  }
  if (
    code === "photo_not_recipe" ||
    code === "import_not_a_recipe" ||
    text.includes("not look like a recipe") ||
    text.includes("couldn't find a recipe") ||
    text.includes("no recipe found") ||
    text.includes("not a recipe page")
  ) {
    return "not_recipe";
  }
  if (code === "photo_timeout" || text.includes("took too long")) return "timeout";
  return "generic";
}

export function photoImportMessageForKind(kind: PhotoImportErrorKind, fallback?: string): string {
  if (kind === "timeout") return PHOTO_IMPORT_TIMEOUT_MESSAGE;
  if (kind === "network") return PHOTO_IMPORT_NETWORK_MESSAGE;
  if (kind === "blurry") return PHOTO_IMPORT_BLURRY_MESSAGE;
  if (kind === "not_recipe") return PHOTO_IMPORT_NOT_RECIPE_MESSAGE;
  if (kind === "cancelled") return PHOTO_IMPORT_CANCELLED_MESSAGE;
  if (/too large|entity too large/i.test(fallback ?? "")) return PHOTO_IMPORT_TOO_LARGE_MESSAGE;
  return fallback?.trim() || "Could not read that photo";
}

export function photoImportErrorKind(error: unknown): PhotoImportErrorKind {
  if (error instanceof Error) {
    if (error.name === "AbortError") return "cancelled";
    if (error.name === "TimeoutError") return "timeout";
    if (
      error.name === "TypeError" ||
      /failed to fetch|networkerror|load failed/i.test(error.message)
    ) {
      return "network";
    }
    return classifyPhotoImportProblem({ detail: error.message });
  }
  return "generic";
}

export function photoImportErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return photoImportMessageForKind(photoImportErrorKind(error), error.message);
  }
  return "Could not read that photo";
}

export function photoImportLead(elapsedMs: number): string {
  if (elapsedMs >= PHOTO_IMPORT_NEAR_TIMEOUT_MS) return PHOTO_IMPORT_NEAR_TIMEOUT;
  if (elapsedMs >= PHOTO_IMPORT_SLOW_MS) return PHOTO_IMPORT_SLOW;
  return `${PHOTO_IMPORT_ESTIMATE}.`;
}

export function photoPageLabel(index: number): string {
  return `Page ${index + 1}`;
}

export function photoImportButtonLabel(pages: number): string {
  return pages > 1 ? `Import ${pages} pages` : "Import recipe";
}

export function photoPageLimitLabel(): string {
  return `Up to ${PHOTO_IMPORT_MAX_PAGES} pages`;
}

/** Rewords single-photo copy for a set of pages. */
export function photoCopyForPages(message: string, pages: number): string {
  if (pages <= 1) return message;
  return message
    .replace(/\bThis photo is\b/g, "These pages are")
    .replace(/\bThat photo is\b/g, "These pages are")
    .replace(/\bThat photo\b/g, "These pages")
    .replace(/\bthat photo\b/g, "these pages")
    .replace(/\bThis photo was\b/g, "These pages were");
}

export function addPhotoPages(current: File[], next: File[]): File[] {
  return [...current, ...next].slice(0, PHOTO_IMPORT_MAX_PAGES);
}

export function movePhotoPage<T>(items: T[], from: number, to: number): T[] {
  if (from === to || to < 0 || to >= items.length) return items;
  const next = items.slice();
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item as T);
  return next;
}

/** Offered only on a poor read, and never after a sharper read already ran. */
export function shouldOfferSharperRead(job: {
  enhanced?: boolean;
  errorKind?: PhotoImportErrorKind | null;
  preview?: { uncertainFields?: string[]; source?: { rawExtractionJson?: any } } | null;
}): boolean {
  if (job.enhanced) return false;
  if (job.errorKind === "blurry") return true;
  if (!job.preview?.uncertainFields?.length) return false;
  const quality = job.preview.source?.rawExtractionJson?.ocrQuality;
  return quality === "poor" || quality === "fair";
}

export function readingStepLabel(pages = 1, enhanced = false): string {
  if (enhanced) return "Sharper read";
  return pages > 1 ? `Reading ${pages} pages` : "Reading";
}

export function elapsedLabel(elapsedMs: number): string {
  const seconds = Math.max(0, Math.floor(elapsedMs / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

/** Changes only at transitions so the live region never ticks. */
export function photoImportAnnouncement(
  phase: PhotoImportPhase,
  options: {
    elapsedMs?: number;
    pages?: number;
    errorMessage?: string | null;
    enhanced?: boolean;
  } = {}
): string {
  const elapsedMs = options.elapsedMs ?? 0;
  const pages = options.pages ?? 1;
  if (phase === "uploading")
    return options.enhanced ? PHOTO_IMPORT_SHARPER_ANNOUNCEMENT : "Uploading.";
  if (phase === "review") return "Ready to review.";
  if (phase === "error") return options.errorMessage?.trim() || "Could not read that photo";
  if (elapsedMs >= PHOTO_IMPORT_NEAR_TIMEOUT_MS) return PHOTO_IMPORT_NEAR_TIMEOUT;
  if (elapsedMs >= PHOTO_IMPORT_SLOW_MS) return "Still reading.";
  return `Upload done. Reading ${pages} ${pages > 1 ? "pages" : "page"}. ${PHOTO_IMPORT_ESTIMATE}.`;
}

export function uploadingStepLabel(percent: number): string {
  return `Uploading ${Math.max(0, Math.min(100, Math.round(percent)))}%`;
}

export function dataUrlPayloadBytes(dataUrl: string): number {
  const payload = dataUrl.split(",")[1] ?? "";
  return Math.floor((payload.length * 3) / 4);
}

export async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error("Could not read that photo"));
    reader.readAsDataURL(file);
  });
}

async function resizePhotoFile(
  file: File,
  options: { maxEdge: number; quality: number }
): Promise<File> {
  if (typeof createImageBitmap !== "function") return file;
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" }).catch(() =>
    createImageBitmap(file)
  );
  const edge = Math.max(bitmap.width, bitmap.height);
  const scale = edge > options.maxEdge ? options.maxEdge / edge : 1;
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  if (scale === 1 && file.type === "image/jpeg" && file.size <= PHOTO_SAVE_MAX_BYTES) {
    bitmap.close();
    return file;
  }
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) {
    bitmap.close();
    return file;
  }
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", options.quality)
  );
  if (!blob) return file;
  return new File([blob], file.name.replace(/\.[^.]+$/, ".jpg"), { type: "image/jpeg" });
}

/** Compress a phone photo so Save can POST it without hitting Vercel's 4.5MB cap. */
export async function compressPhotoForSave(file: File): Promise<string> {
  let next = file;
  try {
    next = await resizePhotoFile(file, { maxEdge: PHOTO_SAVE_MAX_EDGE, quality: 0.72 });
  } catch {
    next = file;
  }
  if (next.size > PHOTO_SAVE_MAX_BYTES) {
    try {
      next = await resizePhotoFile(next, { maxEdge: 960, quality: 0.6 });
    } catch {
      // keep the first resize
    }
  }
  if (next.size > PHOTO_SAVE_MAX_BYTES) {
    throw new Error("That photo is still too large to save. Try a closer crop.");
  }
  const dataUrl = await fileToDataUrl(next);
  if (dataUrlPayloadBytes(dataUrl) > PHOTO_SAVE_MAX_BYTES) {
    throw new Error("That photo is still too large to save. Try a closer crop.");
  }
  return dataUrl;
}

function totalBytes(files: File[]): number {
  return files.reduce((sum, file) => sum + file.size, 0);
}

type Resize = (file: File, options: { maxEdge: number; quality: number }) => Promise<File>;

async function eachFile(
  files: File[],
  options: { maxEdge: number; quality: number },
  transform: Resize
): Promise<File[]> {
  const out: File[] = [];
  // one at a time: 6 x 12MP bitmaps at once can crash iOS Safari
  for (const file of files) {
    out.push(await transform(file, options).catch(() => file));
  }
  return out;
}

async function fitBudget(
  files: File[],
  attempts: Array<{ maxEdge: number; quality: number }>,
  transform: Resize
): Promise<File[]> {
  for (const options of attempts) {
    const out = await eachFile(files, options, transform);
    if (totalBytes(out) <= PHOTO_IMPORT_BUDGET_BYTES) return out;
  }
  throw new Error(PHOTO_IMPORT_TOO_MANY_PAGES_MESSAGE);
}

/** Fits every page under the shared upload budget, or blocks before upload. */
export async function budgetPhotoFiles(
  files: File[],
  resize: Resize = resizePhotoFile
): Promise<File[]> {
  if (totalBytes(files) <= PHOTO_IMPORT_BUDGET_BYTES) return files;
  return fitBudget(
    files,
    [
      { maxEdge: PHOTO_IMPORT_MAX_EDGE, quality: PHOTO_IMPORT_QUALITY },
      { maxEdge: PHOTO_IMPORT_MAX_EDGE, quality: PHOTO_IMPORT_FALLBACK_QUALITY },
    ],
    resize
  );
}

function percentile(histogram: number[], total: number, fraction: number): number {
  const target = total * fraction;
  let seen = 0;
  for (let level = 0; level < 256; level++) {
    seen += histogram[level] ?? 0;
    if (seen >= target) return level;
  }
  return 255;
}

/** Grayscale, 1-99% contrast stretch, then a light 3x3 unsharp mask. Mutates RGBA in place. */
export function enhancePixels(data: Uint8ClampedArray, width: number, height: number) {
  const count = width * height;
  const gray = new Float32Array(count);
  const histogram = new Array(256).fill(0);
  for (let i = 0; i < count; i++) {
    const o = i * 4;
    const value = Math.round(0.299 * data[o]! + 0.587 * data[o + 1]! + 0.114 * data[o + 2]!);
    gray[i] = value;
    histogram[value]++;
  }
  const low = percentile(histogram, count, 0.01);
  const high = Math.max(low + 1, percentile(histogram, count, 0.99));
  const stretched = gray.map((value) => ((value - low) * 255) / (high - low));
  const amount = 0.5;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      let sum = 0;
      for (let dy = -1; dy <= 1; dy++) {
        const row = Math.min(height - 1, Math.max(0, y + dy)) * width;
        for (let dx = -1; dx <= 1; dx++) {
          sum += stretched[row + Math.min(width - 1, Math.max(0, x + dx))]!;
        }
      }
      const value = stretched[i]! + amount * (stretched[i]! - sum / 9);
      const o = i * 4;
      data[o] = data[o + 1] = data[o + 2] = value;
    }
  }
}

/** Second read: from the original, grayscale + contrast + sharpen on canvas. Never generative. */
export async function enhancePhotoFile(
  file: File,
  options: { maxEdge: number; quality: number } = {
    maxEdge: PHOTO_IMPORT_ENHANCE_MAX_EDGE,
    quality: PHOTO_IMPORT_ENHANCE_QUALITY,
  }
): Promise<File> {
  if (typeof createImageBitmap !== "function") return file;
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" }).catch(() =>
    createImageBitmap(file)
  );
  const edge = Math.max(bitmap.width, bitmap.height);
  const scale = edge > options.maxEdge ? options.maxEdge / edge : 1;
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) {
    bitmap.close();
    return file;
  }
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  const pixels = context.getImageData(0, 0, width, height);
  enhancePixels(pixels.data, width, height);
  context.putImageData(pixels, 0, 0);
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", options.quality)
  );
  if (!blob) return file;
  return new File([blob], file.name.replace(/\.[^.]+$/, "-sharper.jpg"), { type: "image/jpeg" });
}

/** Enhanced pages still share the multi-page upload budget. */
export function enhancePhotoFiles(
  files: File[],
  enhance: Resize = enhancePhotoFile
): Promise<File[]> {
  return fitBudget(
    files,
    [
      { maxEdge: PHOTO_IMPORT_ENHANCE_MAX_EDGE, quality: PHOTO_IMPORT_ENHANCE_QUALITY },
      { maxEdge: 2000, quality: 0.85 },
      { maxEdge: PHOTO_IMPORT_MAX_EDGE, quality: PHOTO_IMPORT_QUALITY },
    ],
    enhance
  );
}

export function postPhotoImportForm(
  data: FormData,
  options: {
    signal?: AbortSignal;
    timeoutMs?: number;
    onUploadProgress?: (percent: number) => void;
    onReading?: () => void;
  } = {}
): Promise<PhotoImportPreview> {
  const timeoutMs = options.timeoutMs ?? PHOTO_IMPORT_TIMEOUT_MS;

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    let settled = false;
    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      options.signal?.removeEventListener("abort", onAbort);
      fn();
    };

    const onAbort = () => {
      xhr.abort();
    };

    xhr.open("POST", "/api/v1/recipes/import/photo");
    xhr.withCredentials = true;
    xhr.timeout = timeoutMs;
    xhr.responseType = "text";

    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable) return;
      options.onUploadProgress?.(Math.round((event.loaded / event.total) * 100));
    };
    xhr.upload.onload = () => {
      options.onUploadProgress?.(100);
      options.onReading?.();
    };

    xhr.onload = () => {
      let body: PhotoImportPreview | PhotoImportProblem = {};
      try {
        body = JSON.parse(xhr.responseText || "{}") as PhotoImportPreview | PhotoImportProblem;
      } catch {
        body = { title: xhr.statusText };
      }
      if (xhr.status >= 200 && xhr.status < 300) {
        finish(() => resolve(body as PhotoImportPreview));
        return;
      }
      if (xhr.status === 413) {
        finish(() => reject(new Error(PHOTO_IMPORT_TOO_LARGE_MESSAGE)));
        return;
      }
      const problem = body as PhotoImportProblem;
      const kind = classifyPhotoImportProblem(problem);
      const error = new Error(
        photoImportMessageForKind(
          kind,
          problem.detail || problem.title || "Could not read that photo"
        )
      );
      if (kind === "timeout") error.name = "TimeoutError";
      finish(() => reject(error));
    };

    xhr.onerror = () => {
      const error = new Error(PHOTO_IMPORT_NETWORK_MESSAGE);
      error.name = "TypeError";
      finish(() => reject(error));
    };

    xhr.ontimeout = () => {
      finish(() => reject(abortError("timeout")));
    };

    xhr.onabort = () => {
      finish(() =>
        reject(options.signal?.aborted ? abortError("cancelled") : abortError("timeout"))
      );
    };

    if (options.signal?.aborted) {
      finish(() => reject(abortError("cancelled")));
      return;
    }
    options.signal?.addEventListener("abort", onAbort);
    xhr.send(data);
  });
}

export async function extractPhotoPreviewFromFiles(
  files: File[],
  options: {
    signal?: AbortSignal;
    timeoutMs?: number;
    enhanced?: boolean;
    onPhase?: (phase: Extract<PhotoImportPhase, "uploading" | "reading">) => void;
    onUploadProgress?: (percent: number) => void;
  } = {}
): Promise<PhotoImportPreview> {
  if (options.signal?.aborted) throw abortError("cancelled");
  options.onPhase?.("uploading");
  options.onUploadProgress?.(0);

  const prepared = options.enhanced
    ? await enhancePhotoFiles(files)
    : await budgetPhotoFiles(files);
  if (options.signal?.aborted) throw abortError("cancelled");
  const data = new FormData();
  for (const file of prepared) data.append("image", file);
  if (options.enhanced) data.append("enhanced", "1");

  return postPhotoImportForm(data, {
    signal: options.signal,
    timeoutMs: options.timeoutMs,
    onUploadProgress: options.onUploadProgress,
    onReading: () => options.onPhase?.("reading"),
  });
}
