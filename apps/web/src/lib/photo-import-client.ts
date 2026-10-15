import type { PhotoImportPreview } from "./photo-import";

export const PHOTO_IMPORT_TIMEOUT_MS = 60_000;
export const PHOTO_IMPORT_MAX_EDGE = 1600;
export const PHOTO_IMPORT_TIMEOUT_MESSAGE =
  "That photo took too long to read. Check your connection and try again.";

export type PhotoImportPhase = "uploading" | "reading" | "review" | "error";

export const PHOTO_IMPORT_STEPS: Array<{
  id: Exclude<PhotoImportPhase, "error">;
  label: string;
}> = [
  { id: "uploading", label: "Uploading" },
  { id: "reading", label: "Reading the recipe" },
  { id: "review", label: "Ready to review" },
];

function abortError(name: "timeout" | "cancelled"): Error {
  const error = new Error(
    name === "timeout" ? PHOTO_IMPORT_TIMEOUT_MESSAGE : "Photo import cancelled"
  );
  error.name = name === "timeout" ? "TimeoutError" : "AbortError";
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

export function photoImportErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    if (error.name === "AbortError") return "Photo import cancelled";
    if (error.name === "TimeoutError") return PHOTO_IMPORT_TIMEOUT_MESSAGE;
    return error.message;
  }
  return "Could not read that photo";
}

export async function preparePhotoFile(file: File): Promise<File> {
  if (file.size <= 1.5 * 1024 * 1024 || typeof createImageBitmap !== "function") {
    return file;
  }

  try {
    const bitmap = await createImageBitmap(file);
    const edge = Math.max(bitmap.width, bitmap.height);
    if (edge <= PHOTO_IMPORT_MAX_EDGE) {
      bitmap.close();
      return file;
    }
    const scale = PHOTO_IMPORT_MAX_EDGE / edge;
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
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.82)
    );
    if (!blob) return file;
    return new File([blob], file.name.replace(/\.[^.]+$/, ".jpg"), { type: "image/jpeg" });
  } catch {
    return file;
  }
}

export async function extractPhotoPreviewFromFiles(
  files: File[],
  options: {
    signal?: AbortSignal;
    timeoutMs?: number;
    onPhase?: (phase: Extract<PhotoImportPhase, "uploading" | "reading">) => void;
  } = {}
): Promise<PhotoImportPreview> {
  const timeoutMs = options.timeoutMs ?? PHOTO_IMPORT_TIMEOUT_MS;
  const controller = new AbortController();
  const onAbort = () => controller.abort();
  options.signal?.addEventListener("abort", onAbort);
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    if (options.signal?.aborted) throw abortError("cancelled");
    options.onPhase?.("uploading");
    const data = new FormData();
    for (const file of await Promise.all(files.map(preparePhotoFile))) {
      if (controller.signal.aborted) {
        throw options.signal?.aborted ? abortError("cancelled") : abortError("timeout");
      }
      data.append("image", file);
    }

    options.onPhase?.("reading");
    const response = await fetch("/api/v1/recipes/import/photo", {
      method: "POST",
      credentials: "include",
      body: data,
      signal: controller.signal,
    });
    if (!response.ok) {
      const problem = (await response.json().catch(() => ({ title: response.statusText }))) as {
        detail?: string;
        title?: string;
      };
      throw new Error(problem.detail || problem.title || "Could not read that photo");
    }
    return (await response.json()) as PhotoImportPreview;
  } catch (error) {
    if (options.signal?.aborted) throw abortError("cancelled");
    if (controller.signal.aborted) throw abortError("timeout");
    if (error instanceof Error && error.name === "AbortError") throw abortError("timeout");
    throw error;
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener("abort", onAbort);
  }
}
