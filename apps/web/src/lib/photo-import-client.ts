import type { PhotoImportPreview } from "./photo-import";

export const PHOTO_IMPORT_TIMEOUT_MS = 60_000;
export const PHOTO_IMPORT_MAX_EDGE = 1600;
/** Stay under Vercel's 4.5MB body limit after base64. Demo has no Blob. */
export const PHOTO_SAVE_MAX_EDGE = 1280;
export const PHOTO_SAVE_MAX_BYTES = 700_000;
export const PHOTO_IMPORT_ESTIMATE = "Usually about 15 seconds";
export const PHOTO_IMPORT_IN_PROGRESS = "Import in progress";
export const PHOTO_IMPORT_TIMEOUT_MESSAGE =
  "That photo took too long to read. Try again, or type or paste it.";
export const PHOTO_IMPORT_BLURRY_MESSAGE =
  "This photo is too blurry to read. Try a sharper shot, or type or paste it.";
export const PHOTO_IMPORT_NOT_RECIPE_MESSAGE =
  "That does not look like a recipe. Type or paste it instead.";
export const PHOTO_IMPORT_NETWORK_MESSAGE = "Connection lost. Check your network and try again.";
export const PHOTO_IMPORT_CANCELLED_MESSAGE = "Photo import cancelled";
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

export function photoImportStepReached(
  step: (typeof PHOTO_IMPORT_STEPS)[number]["id"],
  phase: PhotoImportPhase
): boolean {
  const order: Array<(typeof PHOTO_IMPORT_STEPS)[number]["id"]> = [
    "uploading",
    "reading",
    "review",
  ];
  const current = phase === "error" ? "reading" : phase;
  return order.indexOf(step) <= order.indexOf(current);
}

export function classifyPhotoImportProblem(problem: PhotoImportProblem): PhotoImportErrorKind {
  const code = (problem.code ?? "").toLowerCase();
  const text = `${problem.detail ?? ""} ${problem.title ?? ""}`.toLowerCase();
  if (code === "photo_blurry" || text.includes("blurry")) return "blurry";
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

export function photoImportAnnouncement(
  phase: PhotoImportPhase,
  percent: number,
  errorMessage?: string | null
): string {
  if (phase === "uploading") {
    return `Uploading ${Math.max(0, Math.min(100, percent))}%. ${PHOTO_IMPORT_ESTIMATE}.`;
  }
  if (phase === "reading") return `Reading. ${PHOTO_IMPORT_ESTIMATE}.`;
  if (phase === "review") return "Ready to review.";
  return errorMessage?.trim() || "Could not read that photo";
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
  const bitmap = await createImageBitmap(file);
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

export async function preparePhotoFile(file: File): Promise<File> {
  if (file.size <= 1.5 * 1024 * 1024) return file;
  try {
    return await resizePhotoFile(file, { maxEdge: PHOTO_IMPORT_MAX_EDGE, quality: 0.82 });
  } catch {
    return file;
  }
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
    onPhase?: (phase: Extract<PhotoImportPhase, "uploading" | "reading">) => void;
    onUploadProgress?: (percent: number) => void;
  } = {}
): Promise<PhotoImportPreview> {
  if (options.signal?.aborted) throw abortError("cancelled");
  options.onPhase?.("uploading");
  options.onUploadProgress?.(0);

  const data = new FormData();
  for (const file of await Promise.all(files.map(preparePhotoFile))) {
    if (options.signal?.aborted) throw abortError("cancelled");
    data.append("image", file);
  }

  return postPhotoImportForm(data, {
    signal: options.signal,
    timeoutMs: options.timeoutMs,
    onUploadProgress: options.onUploadProgress,
    onReading: () => options.onPhase?.("reading"),
  });
}
